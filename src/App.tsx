import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Plus, Download, Edit, Mic, MicOff, Camera, ArrowUp, ArrowDown, Share2, Copy } from 'lucide-react';

const SpellingGridGenerator = () => {
  const [words, setWords] = useState(['']);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  // Check for shared words in URL on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedWords = urlParams.get('words');
    if (sharedWords) {
      try {
        const wordList = JSON.parse(decodeURIComponent(sharedWords));
        if (Array.isArray(wordList) && wordList.length > 0) {
          setWords(wordList.slice(0, 12));
          setTextInput(wordList.join('\n'));
          setShowTextInput(false);
          showStatus('✅ Spelling grid loaded from shared link!');
        }
      } catch (error) {
        showStatus('Error loading shared grid. Please try again.', true);
      }
    }
  }, []);

  // OpenRouter API key
  const OPENROUTER_API_KEY = "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";

  const showStatus = (message: string, isError = false) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), isError ? 5000 : 3000);
  };

  const handleTextInputSubmit = () => {
    const wordList = textInput
      .split('\n')
      .map(word => word.trim())
      .filter(word => word.length > 0)
      .slice(0, 12);
    
    setWords(wordList.length > 0 ? wordList : ['']);
    setShowTextInput(false);
  };

  const updateWord = (index: number, newWord: string) => {
    const newWords = [...words];
    newWords[index] = newWord;
    setWords(newWords);
  };

  const deleteWord = (index: number) => {
    if (words.length > 1) {
      const newWords = words.filter((_, i) => i !== index);
      setWords(newWords);
    }
  };

  const addWord = () => {
    if (words.length < 12) {
      setWords([...words, '']);
    }
  };

  // Simple arrow-based reordering for mobile
  const moveWordUp = (index: number) => {
    if (index > 0) {
      const newWords = [...words];
      [newWords[index], newWords[index - 1]] = [newWords[index - 1], newWords[index]];
      setWords(newWords);
    }
  };

  const moveWordDown = (index: number) => {
    if (index < words.length - 1) {
      const newWords = [...words];
      [newWords[index], newWords[index + 1]] = [newWords[index + 1], newWords[index]];
      setWords(newWords);
    }
  };

  // Generate share URL
  const generateShareUrl = () => {
    const filteredWords = words.filter(word => word.trim().length > 0);
    if (filteredWords.length === 0) {
      showStatus('Please add some words first!', true);
      return;
    }

    const wordsParam = encodeURIComponent(JSON.stringify(filteredWords));
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?words=${wordsParam}`;
    
    setShareUrl(shareUrl);
    setShowShareModal(true);
  };

  // Copy share URL to clipboard
  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showStatus('✅ Share link copied to clipboard!');
      setShowShareModal(false);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showStatus('✅ Share link copied to clipboard!');
      setShowShareModal(false);
    }
  };

  // Microphone recording with better error handling
  const startRecording = async () => {
    try {
      // Request microphone permission more explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      showStatus('🎤 Recording... Speak your spelling words clearly');
    } catch (error) {
      console.error('Microphone error:', error);
      if (error.name === 'NotAllowedError') {
        showStatus('Microphone permission denied. Please allow microphone access in your browser settings.', true);
      } else if (error.name === 'NotFoundError') {
        showStatus('No microphone found. Please check your device.', true);
      } else {
        showStatus('Microphone not available. Please try typing the words instead.', true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      showStatus('🔄 Processing your audio...');
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.text && data.text.trim()) {
        await processWordsWithAI(data.text, 'audio');
      } else {
        showStatus('Could not understand the audio. Please speak more clearly and try again.', true);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      showStatus('Error processing audio. Please try again or use text input.', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Photo upload with better camera handling
  const handlePhotoClick = () => {
    // Try to access camera first
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          // Stop the stream immediately - we just wanted to check permission
          stream.getTracks().forEach(track => track.stop());
          // Now open file picker
          fileInputRef.current?.click();
        })
        .catch(error => {
          console.error('Camera permission error:', error);
          if (error.name === 'NotAllowedError') {
            showStatus('Camera permission denied. Please allow camera access in your browser settings.', true);
          } else {
            showStatus('Camera not available. Please try the text input instead.', true);
          }
        });
    } else {
      // Fallback to file picker without camera check
      fileInputRef.current?.click();
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's actually an image
    if (!file.type.startsWith('image/')) {
      showStatus('Please select an image file.', true);
      return;
    }

    setIsProcessing(true);
    showStatus('📸 Processing your image...');

    try {
      const base64 = await convertToBase64(file);
      await processImageWithAI(base64);
    } catch (error) {
      console.error('Image processing error:', error);
      showStatus('Error processing image. Please try again or use text input.', true);
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const processImageWithAI = async (base64Image: string) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Look at this image and extract all spelling words you can see. Return only a simple list of individual words, one per line, suitable for spelling practice. Ignore sentences, focus only on individual words that would be good for spelling tests.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        await processWordsWithAI(data.choices[0].message.content, 'image');
      } else {
        showStatus('Could not find any words in the image. Please try a clearer photo.', true);
      }
    } catch (error) {
      console.error('Image AI error:', error);
      showStatus('Error reading image. Please try again or use text input.', true);
    }
  };

  const processWordsWithAI = async (text: string, source: string) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4',
          messages: [
            {
              role: 'user',
              content: `Extract individual spelling words from this text: "${text}". Return only a clean list of words, one per line, maximum 12 words. Remove any punctuation, numbers, or extra text. Focus on words suitable for spelling practice. Just the words, nothing else.`
            }
          ],
          max_tokens: 300
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const extractedText = data.choices[0].message.content;
        const wordList = extractedText
          .split('\n')
          .map(word => word.trim().replace(/^\d+\.?\s*/, '').replace(/[^\w]/g, '')) // Remove numbers and punctuation
          .filter(word => word.length > 0 && word.length < 20) // Reasonable word length
          .slice(0, 12);

        if (wordList.length > 0) {
          setTextInput(wordList.join('\n'));
          setWords(wordList);
          setShowTextInput(false);
          showStatus(`✅ Found ${wordList.length} words from ${source}!`);
        } else {
          showStatus(`No suitable spelling words found from ${source}. Please try again.`, true);
        }
      }
    } catch (error) {
      console.error('Word processing error:', error);
      showStatus('Error processing words. Please try text input instead.', true);
    }
  };

  // PDF generation without popups - using download instead
  const generatePDF = () => {
    const filteredWords = words.filter(word => word.trim().length > 0);
    
    if (filteredWords.length === 0) {
      showStatus('Please add some words first!', true);
      return;
    }

    try {
      // Create HTML content
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Spelling Grid</title>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 20px;
                background: white;
                color: black;
              }
              h1 {
                text-align: center;
                margin-bottom: 30px;
                font-size: 24px;
                color: black;
              }
              .spelling-grid {
                border-collapse: collapse;
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
              }
              .spelling-grid th,
              .spelling-grid td {
                border: 2px solid #000;
                padding: 15px;
                text-align: left;
                height: 50px;
                vertical-align: middle;
              }
              .spelling-grid th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: center;
                font-size: 16px;
              }
              .word-cell {
                font-weight: bold;
                width: 200px;
                background-color: #f8f8f8;
                font-size: 16px;
              }
              .practice-cell {
                width: 200px;
                background-color: white;
              }
              @media print {
                body { 
                  margin: 15px; 
                }
                .spelling-grid { 
                  font-size: 14px; 
                }
                .spelling-grid th,
                .spelling-grid td {
                  padding: 12px;
                  height: 45px;
                }
              }
              @page {
                size: A4;
                margin: 1cm;
              }
            </style>
          </head>
          <body>
            <h1>Spelling Practice Grid</h1>
            <table class="spelling-grid">
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Read</th>
                  <th>Copy</th>
                  <th>Write</th>
                </tr>
              </thead>
              <tbody>
                ${filteredWords.map(word => `
                  <tr>
                    <td class="word-cell">${word}</td>
                    <td class="practice-cell"></td>
                    <td class="practice-cell"></td>
                    <td class="practice-cell"></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spelling-grid.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showStatus('✅ Spelling grid downloaded! Open the file and print it.');
      
    } catch (error) {
      console.error('PDF generation error:', error);
      showStatus('Error generating file. Please try again.', true);
    }
  };

  const resetToTextInput = () => {
    setShowTextInput(true);
    setTextInput(words.filter(w => w.trim()).join('\n'));
  };

  // Share Modal Component
  const ShareModal = () => {
    if (!showShareModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-bold mb-4">Share Spelling Grid</h3>
          <p className="text-gray-600 mb-4">
            Share this link so others can use your spelling grid:
          </p>
          <div className="bg-gray-100 p-3 rounded border text-sm break-all mb-4">
            {shareUrl}
          </div>
          <div className="flex gap-3">
            <button
              onClick={copyShareUrl}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </button>
            <button
              onClick={() => setShowShareModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (showTextInput) {
    return (
      <div className="max-w-2xl mx-auto p-4 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Spelling Grid Generator
        </h1>

        {statusMessage && (
          <div className={`mb-4 p-3 rounded-lg text-center text-sm ${statusMessage.includes('Error') || statusMessage.includes('denied') || statusMessage.includes('not') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {statusMessage}
          </div>
        )}

        {/* AI Input Options */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all text-lg font-medium ${
              isRecording 
                ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' 
                : 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            <span>
              {isRecording ? '🛑 Stop Recording' : '🎤 Record Spelling Words'}
            </span>
          </button>

          <button
            onClick={handlePhotoClick}
            disabled={isProcessing}
            className="flex items-center justify-center gap-3 p-4 rounded-lg border-2 bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200 transition-all text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="h-6 w-6" />
            <span>📸 Take Photo of Words</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
          className="hidden"
        />

        {isProcessing && (
          <div className="text-center mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-blue-700 font-medium">Processing...</p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-lg font-medium text-gray-700 mb-3">
            Or type your spelling words (one word per line):
          </label>
          <textarea
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-base"
            placeholder="ambitious&#10;amphibious&#10;fictitious&#10;nutritious&#10;suspicious&#10;delicious&#10;precious&#10;spacious"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <p className="text-sm text-gray-500 mt-2">Maximum 12 words</p>
        </div>
        
        <button
          onClick={handleTextInputSubmit}
          disabled={isProcessing}
          className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg disabled:opacity-50"
        >
          Create Spelling Grid
        </button>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-600">
          <p className="mb-2">
            Built by{' '}
            <a 
              href="https://www.linkedin.com/in/dancourse/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Dan Course
            </a>
          </p>
          <p className="text-sm">
            Send a grid • Share your spelling lists • Make learning fun
          </p>
        </footer>
      </div>
    );
  }

  const filteredWords = words.filter(word => word.trim().length > 0);

  return (
    <div className="max-w-6xl mx-auto p-4 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Spelling Grid Generator
      </h1>

      {statusMessage && (
        <div className={`mb-4 p-3 rounded-lg text-center ${statusMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {statusMessage}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-center">
        <button
          onClick={resetToTextInput}
          className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <Edit className="h-5 w-5" />
          Edit Word List
        </button>
        
        <button
          onClick={generateShareUrl}
          disabled={filteredWords.length === 0}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Share2 className="h-5 w-5" />
          Share Grid
        </button>
        
        <button
          onClick={generatePDF}
          disabled={filteredWords.length === 0}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Download className="h-5 w-5" />
          Download Spelling Grid
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Word Editor - Mobile Friendly */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Edit Words</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
            {words.map((word, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white p-3 rounded border shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveWordUp(index)}
                    disabled={index === 0}
                    className="p-2 text-gray-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed border rounded"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveWordDown(index)}
                    disabled={index === words.length - 1}
                    className="p-2 text-gray-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed border rounded"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                
                <span className="text-sm font-medium text-gray-500 w-8">
                  {index + 1}.
                </span>
                
                <input
                  type="text"
                  value={word}
                  onChange={(e) => updateWord(index, e.target.value)}
                  className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder={`Word ${index + 1}`}
                />
                
                <button
                  onClick={() => deleteWord(index)}
                  disabled={words.length <= 1}
                  className="p-3 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed border rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          
          {words.length < 12 && (
            <button
              onClick={addWord}
              className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
            >
              <Plus className="h-4 w-4" />
              Add Word
            </button>
          )}
        </div>

        {/* Preview */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Preview</h2>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white overflow-x-auto">
            <table className="w-full min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-2 border-gray-300 p-3 text-left font-bold">Word</th>
                  <th className="border-2 border-gray-300 p-3 text-center font-bold">Read</th>
                  <th className="border-2 border-gray-300 p-3 text-center font-bold">Copy</th>
                  <th className="border-2 border-gray-300 p-3 text-center font-bold">Write</th>
                </tr>
              </thead>
              <tbody>
                {filteredWords.map((word, index) => (
                  <tr key={index}>
                    <td className="border-2 border-gray-300 p-3 font-medium bg-gray-50">{word}</td>
                    <td className="border-2 border-gray-300 p-3 h-12"></td>
                    <td className="border-2 border-gray-300 p-3 h-12"></td>
                    <td className="border-2 border-gray-300 p-3 h-12"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredWords.length === 0 && (
            <p className="text-gray-500 text-center mt-4 text-lg">Add some words to see the preview</p>
          )}
          
          {filteredWords.length > 0 && (
            <p className="text-green-600 text-center mt-4 font-medium">
              Ready to download! {filteredWords.length} word{filteredWords.length !== 1 ? 's' : ''} in your grid.
            </p>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal />

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-600">
        <p className="mb-2">
          Built by{' '}
          <a 
            href="https://www.linkedin.com/in/dancourse/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Dan Course
          </a>
        </p>
        <p className="text-sm">
          Send a grid • Share your spelling lists • Make learning fun
        </p>
      </footer>
    </div>
  );
};

export default SpellingGridGenerator;