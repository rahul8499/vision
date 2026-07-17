import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export const AudioMessage = ({ uri }: { uri: string }) => {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const playSound = async () => {
        try {
            if (sound) {
                if (isPlaying) {
                    await sound.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await sound.playAsync();
                    setIsPlaying(true);
                }
                return;
            }
            const { sound: newSound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
            setSound(newSound);
            setIsPlaying(true);
            
            newSound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                    newSound.setPositionAsync(0);
                }
            });
        } catch (error) {
            console.error("Audio playback error:", error);
        }
    };

    useEffect(() => {
        return sound ? () => { sound.unloadAsync(); } : undefined;
    }, [sound]);

    return (
        <TouchableOpacity 
            onPress={playSound} 
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderRadius: 9999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                width: 180,
                marginBottom: 4,
                marginRight: 24
            }}
        >
            <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#ffffff',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8
            }}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="#075E54" />
            </View>
            <View style={{
                flex: 1,
                height: 4,
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: 9999,
                overflow: 'hidden'
            }}>
                <View style={{
                    height: '100%',
                    backgroundColor: '#075E54',
                    width: '100%',
                    opacity: isPlaying ? 1 : 0.5
                }} />
            </View>
        </TouchableOpacity>
    );
};
