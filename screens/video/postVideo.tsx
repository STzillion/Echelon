import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import type { ViewToken } from 'react-native';

interface SocialVideoPlayerProps {
  uri: string;
  isVisible: boolean; // Track if in viewport
}

export function PostVideo({ uri, isVisible }: SocialVideoPlayerProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible]);

  useEffect(() => {
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'ready' && status.videoSize) {
        const { width, height } = status.videoSize;
        if (width && height) {
          setAspectRatio(width / height);
        }
      }
    });

    return () => sub.remove();
  }, []);

  const toggleMute = () => {
    player.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  function getVideoStyle(aspectRatio: number | null): import("react-native").StyleProp<import("react-native").ViewStyle> {
    if (!aspectRatio) {
      return styles.video;
    }
    return [styles.video, { aspectRatio }];
  }

  function getContainerStyle(aspectRatio: number | null): import("react-native").StyleProp<import("react-native").ViewStyle> {
    if (!aspectRatio) {
      return {};
    }
    return { height: undefined, aspectRatio };
  }

  return (
    <View style={[styles.container, getContainerStyle(aspectRatio)]}>
      <Pressable onPress={() => setShowControls(true)}>
        <VideoView
          player={player}
          style={getVideoStyle(aspectRatio)}
          contentFit="contain"
          nativeControls={showControls}
          allowsFullscreen
        />
      </Pressable>

      {/*<Pressable style={styles.muteButton} onPress={toggleMute}>
        {isMuted ? <VolumeX size={16} color="white" /> : <Volume2 size={16} color="white" />}
      </Pressable>
      */}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  muteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 50,
  },
});