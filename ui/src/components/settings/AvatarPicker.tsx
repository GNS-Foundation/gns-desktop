// ===========================================
// GNS BROWSER - AVATAR PICKER COMPONENT
// ===========================================

import React, { useRef } from 'react';
import { Camera, Image, X, Smile } from 'lucide-react';
import { FACET_EMOJIS } from '../../types/profile';
import { fileToBase64, resizeImage } from '../../lib/profile';

interface AvatarPickerProps {
  currentAvatar?: string;
  currentEmoji: string;
  onAvatarChange: (avatarUrl: string | undefined) => void;
  onEmojiChange: (emoji: string) => void;
  onClose: () => void;
}

export function AvatarPicker({
  currentAvatar,
  currentEmoji,
  onAvatarChange,
  onEmojiChange,
  onClose,
}: AvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojis, setShowEmojis] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setLoading(true);
    try {
      const dataUrl = await fileToBase64(file);
      const resized = await resizeImage(dataUrl, 400, 400, 0.8);
      onAvatarChange(resized);
      onClose();
    } catch (e) {
      console.error('Error processing image:', e);
      alert('Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAvatar = () => {
    onAvatarChange(undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-[#161B22] w-full max-w-md rounded-t-2xl p-6 animate-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Change Photo</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#21262D] rounded-full">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Current Avatar Preview */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#21262D] flex items-center justify-center overflow-hidden border-4 border-[#30363D]">
              {currentAvatar ? (
                <img 
                  src={currentAvatar} 
                  alt="Current avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl">{currentEmoji}</span>
              )}
            </div>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {/* Camera - disabled for now (needs native integration) */}
          <button
            disabled
            className="w-full flex items-center gap-4 p-4 bg-[#21262D] rounded-xl opacity-50 cursor-not-allowed"
          >
            <Camera size={24} className="text-gray-400" />
            <div className="text-left">
              <div className="text-white">Take Photo</div>
              <div className="text-gray-500 text-sm">Coming soon</div>
            </div>
          </button>

          {/* Gallery */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-4 p-4 bg-[#21262D] rounded-xl hover:bg-[#30363D] transition-colors"
          >
            <Image size={24} className="text-blue-400" />
            <div className="text-left">
              <div className="text-white">Choose from Gallery</div>
              <div className="text-gray-500 text-sm">Select an image from your device</div>
            </div>
          </button>

          {/* Emoji Picker */}
          <button
            onClick={() => setShowEmojis(!showEmojis)}
            className="w-full flex items-center gap-4 p-4 bg-[#21262D] rounded-xl hover:bg-[#30363D] transition-colors"
          >
            <Smile size={24} className="text-yellow-400" />
            <div className="text-left flex-1">
              <div className="text-white">Choose Emoji</div>
              <div className="text-gray-500 text-sm">Use an emoji as your avatar</div>
            </div>
            <span className="text-2xl">{currentEmoji}</span>
          </button>

          {/* Emoji Grid */}
          {showEmojis && (
            <div className="bg-[#21262D] rounded-xl p-4">
              <div className="grid grid-cols-5 gap-2">
                {FACET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onEmojiChange(emoji);
                      onAvatarChange(undefined); // Clear photo when selecting emoji
                    }}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition-colors ${
                      currentEmoji === emoji && !currentAvatar
                        ? 'bg-blue-500/30 border-2 border-blue-500'
                        : 'bg-[#30363D] hover:bg-[#3D444D] border-2 border-transparent'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Remove Photo */}
          {currentAvatar && (
            <button
              onClick={handleRemoveAvatar}
              className="w-full flex items-center gap-4 p-4 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              <X size={24} className="text-red-400" />
              <div className="text-left">
                <div className="text-red-400">Remove Photo</div>
                <div className="text-red-400/60 text-sm">Use emoji instead</div>
              </div>
            </button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}

export default AvatarPicker;
