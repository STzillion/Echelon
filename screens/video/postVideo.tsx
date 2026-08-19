import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
    const sub = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') {
        const size = player.videoTrack?.size;
        if (size?.width && size?.height) {
          setAspectRatio(size.width / size.height);
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