import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';

type Rating = { rating: number; feedback: string } | null;

export function SupportRatingCard({ value, onSubmit }: { value: Rating; onSubmit: (rating: number, feedback: string) => Promise<Rating> }) {
  const [score, setScore] = useState(value?.rating || 0);
  const [feedback, setFeedback] = useState(value?.feedback || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScore(value?.rating || 0);
    setFeedback(value?.feedback || '');
  }, [value]);

  const save = async () => {
    if (!score) return Alert.alert('Choose a rating', 'Tap 1 to 5 stars before submitting.');
    try {
      setSaving(true);
      await onSubmit(score, feedback.trim());
      Alert.alert('Thank you', 'Your support rating has been saved.');
    } catch (error) {
      Alert.alert('Could not save rating', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <Text className="font-black text-slate-900">How was your support experience?</Text>
      <Text className="mt-1 text-xs text-slate-600">Your rating helps us improve support quality.</Text>
      <View className="mt-3 flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setScore(star)} className="mr-2 p-1" accessibilityLabel={`${star} star rating`}>
            <MaterialCommunityIcons name={star <= score ? 'star' : 'star-outline'} size={31} color="#d97706" />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        value={feedback}
        onChangeText={setFeedback}
        maxLength={2000}
        multiline
        placeholder="Tell us what went well or what we can improve (optional)"
        className="mt-3 min-h-[76px] rounded-xl border border-amber-200 bg-white px-3 py-3 text-slate-800"
        textAlignVertical="top"
      />
      <TouchableOpacity disabled={saving} onPress={save} className="mt-3 items-center rounded-xl bg-amber-600 py-3">
        {saving ? <ActivityIndicator color="white" /> : <Text className="font-black text-white">{value ? 'Update rating' : 'Submit rating'}</Text>}
      </TouchableOpacity>
    </View>
  );
}
