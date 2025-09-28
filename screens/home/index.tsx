// Helper to format time difference
function timeAgo(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 0 || diffSec < 600) return 'just now'; // less than 10 minutes
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}hr`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek}w`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}y`;
}
import React from 'react';
import {Pressable, ScrollView} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallbackText, AvatarImage, AvatarBadge } from '@/components/ui/avatar';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Images, Camera, Mic, VideoIcon, Hash, Scale, Heart, MessageCircle, Vote, MoreHorizontal } from 'lucide-react-native';
import { usePosts } from '@/providers/PostsProvider';
import { VStack } from '@/components/ui/vstack';
import { Divider } from '@/components/ui/divider';
import { router } from 'expo-router';



export default function HomeScreen() {
  const { user } = useAuth();
  const { posts } = usePosts();
  // Show all posts, not just user's
  return (
    <SafeAreaView style={styles.container}>
      {/* Minimal header with centered logo */}
       <View style={styles.header}>
        <View style={styles.leftContainer}>
          <View style={styles.logoCircle}>
            <Image
              source={require('@/assets/images/EchelonLogo3d.png')} // Your logo path here
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>
      {/* Feed */}
      <ScrollView style={styles.feed} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {(posts?.length ?? 0) === 0 ? (
          <Text style={{ color: 'gray', textAlign: 'center', marginTop: 24 }}>No posts yet.</Text>
        ) : null}
        {(posts ?? []).map((post, idx) => (
          <React.Fragment key={post.id}>
            <View style={styles.postCard}>
              {post.user?.avatar ? (
                <Avatar size="md" style={styles.avatar}>
                  <AvatarImage source={{ uri: post.user?.avatar }} />
                </Avatar>
              ) : (
                <View style={styles.grayCircleAvatar}>
                  <Text style={styles.grayCircleText}>{post.user?.username?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <View style={styles.postContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={styles.username}>{post.user?.username || (user as any)?.username}</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
                    {timeAgo(post.created_at)}
                  </Text>
                </View>
                <Text style={styles.postText}>{post.text}</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.actionIcon}>
                    <Scale size={22} color="#b0b0b0" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon}>
                    <Heart size={22} color="#b0b0b0" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon}>
                    <MessageCircle size={22} color="#b0b0b0" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon}>
                    <Vote size={22} color="#b0b0b0" />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Three-dot menu (optional, can be added later) */}
            </View>
            {idx < ((posts?.length ?? 0) - 1) && (
              <View style={styles.divider} />
            )}
          </React.Fragment>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
     flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181818',
    paddingHorizontal: 156,
    paddingVertical: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
    logo: {
    width: 100,
    height: 100,
    marginRight: 1,
    
  },
  feed: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0f0f0f',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    marginRight: 12,
  },
  postContent: {
    flex: 1,
    flexDirection: 'column',
  },
  username: {
    color: 'white',
    fontWeight: '500',
    fontSize: 15,
    marginBottom: 2,
  },
  postText: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 36,
  },
  actionIcon: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginTop: 8,
    width: '100%',
    alignSelf: 'center',
  },
  grayCircleAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  grayCircleText: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 15,
  },
    leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
});

