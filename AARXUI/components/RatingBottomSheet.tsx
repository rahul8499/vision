import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import Modal from 'react-native-modal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';

interface RatingBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  orderId: number;
  raterType: 'user' | 'store';
  orderStatus: string;
  cancelledBy?: string;
  onSuccess?: () => void;
}

export default function RatingBottomSheet({
  isVisible,
  onClose,
  orderId,
  raterType,
  orderStatus,
  cancelledBy,
  onSuccess
}: RatingBottomSheetProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

  const getTags = () => {
    if (raterType === 'user') {
      if (orderStatus === 'cancelled' && cancelledBy === 'store') {
        return ['Out of stock', 'Price issue', 'Delay'];
      }
      return ['Fast service', 'Genuine medicine', 'Good pricing', 'Late delivery', 'Wrong items'];
    } else {
      if (orderStatus === 'cancelled' && cancelledBy === 'user') {
        return ['Fake order', 'Last moment cancel'];
      }
      return ['Responsive', 'Quick pickup', 'Not reachable', 'No show'];
    }
  };

  const tags = getTags();

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Toast.show({ type: 'error', text1: 'Rating Required', text2: 'Please select at least 1 star.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('authToken');
      await axios.post(`${BASE_URL}/api/ratings/submit/`, {
        order_id: orderId,
        rating: rating,
        review: review,
        tags: selectedTags
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      Toast.show({ type: 'success', text1: 'Thank You!', text2: 'Rating submitted successfully.' });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Rating submission failed:', error.response?.data || error.message);
      Toast.show({ type: 'error', text1: 'Submission Failed', text2: 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
      backdropOpacity={0.4}
    >
      <View className="bg-white rounded-t-[3.5rem] p-10 shadow-2xl border-t border-slate-100">
        <View className="items-center mb-6">
          <View className="w-16 h-1.5 bg-slate-100 rounded-full" />
        </View>

        <Text className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">
          {raterType === 'user' ? 'Rate Store' : 'Rate Customer'}
        </Text>
        <Text className="text-[10px] font-bold text-emerald-600 uppercase tracking-[4px] mb-8">
          Help build a trusted medical network
        </Text>

        {/* Stars */}
        <View className="flex-row justify-center gap-4 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <MaterialCommunityIcons
                name={star <= rating ? "star" : "star-outline"}
                size={40}
                color={star <= rating ? "#fbbf24" : "#e2e8f0"}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Tags */}
        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">Select Tags</Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {tags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => toggleTag(tag)}
                className={`py-2 px-4 rounded-full border ${isSelected ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-200'}`}
              >
                <Text className={`text-[10px] font-bold uppercase ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Review */}
        <TextInput
          placeholder="Share your experience (optional)..."
          placeholderTextColor="#94a3b8"
          multiline
          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 text-sm mb-8 h-24"
          value={review}
          onChangeText={setReview}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          disabled={isSubmitting}
          onPress={handleSubmit}
          className={`py-6 rounded-[2rem] items-center shadow-lg ${isSubmitting ? 'bg-slate-400' : 'bg-slate-900 shadow-slate-400'}`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-xs uppercase tracking-[4px]">Submit Feedback</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
