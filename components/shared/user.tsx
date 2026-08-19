"use client";
import { Avatar, AvatarBadge, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { User } from '@/providers/PostsProvider';
import { useUploadFile } from '@/providers/uploadfile';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


const tabs = [
  { key: 'opinions', label: 'Opinions' },
  { key: 'replies', label: 'Debates' },
  { key: 'highlights', label: 'Highlights' },
  { key: 'articles', label: 'Articles' },
  { key: 'media', label: 'Media' },
] as const;



type TabKey = (typeof tabs)[number]['key'];

export default ({ user }: { user?: User }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('opinions');
  const { logOut, user: authUser } = useAuth() as any;
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [ImageFilename, setImageFilename] = useState<string | null>(null); 
  const uploadFile = useUploadFile().uploadFile;
  const isOwnProfile = Boolean(user?.id) && authUser?.id === user?.id;
  const imageUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${user?.id}/${user?.avatar}`;

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (error) {
      Alert.alert('Logout failed', 'Please try again.');
    }
  };

    const addphoto = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
  
      
  
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const type = result.assets[0].mimeType ?? 'image/jpeg';
        const id = result.assets[0].assetId ?? Crypto.randomUUID();
        setPhoto(uri);
  
        
        const userId = (user as any)?.id;
        if (!userId) {
          Alert.alert('Upload error', 'User not signed in.');
          setPhoto('');
          setImageFilename(null);
          return;
        }
        const generatedName = `avatar.${type.split('/')[1]}`;
        const uploadedName = await uploadFile(
          userId,
          uri,
          type,
          generatedName
        );
  
  
  
        if (uploadedName) {
          setImageFilename(uploadedName);
        } else {
          Alert.alert('Upload error', 'Failed to upload image.');
          setPhoto('');
          setImageFilename(null);
        }
      }
      
    }

  return (
    <SafeAreaView style={styles.container}>
     

      <View style={styles.cover} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSummary}>
          <View>
            <Pressable onPress={addphoto} style={styles.avatarFrame}>
              <Avatar size="lg" className="bg-gray-600">
                <AvatarBadge size="lg" style={styles.avatarBadge}>
                  <Text size="sm" bold style={styles.avatarBadgeText}>
                    {user?.username ? user.username[0]?.toUpperCase() : ''}
                  </Text>
                </AvatarBadge>
                <AvatarFallbackText>
                  {user?.username ? user.username[0]?.toUpperCase() : ''}
                </AvatarFallbackText>
                <AvatarImage source={{ uri: imageUrl}} />
              </Avatar>
            </Pressable>
          </View>
          <View style={styles.nameRow}>
            <Text size="3xl" bold style={styles.userName}>
              {user?.username ?? 'Unknown User'}
            </Text>
            <Text size="sm" style={styles.userHandle}>
              @{user?.username?.toLowerCase() ?? 'unknown'}
            </Text>
          </View>
        </View>

        <Text size="sm" style={styles.bioText}>
          Still processing... ?? | Just a huge nerd ?? | CS student
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text bold style={styles.statNumber}>
              700
            </Text>
            <Text size="sm" style={styles.statLabel}>
              posts
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text bold style={styles.statNumber}>
              167
            </Text>
            <Text size="sm" style={styles.statLabel}>
              following
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text bold style={styles.statNumber}>
              51
            </Text>
            <Text size="sm" style={styles.statLabel}>
              followers
            </Text>
          </View>
        </View>

        {isOwnProfile ? (
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text size="sm" bold style={styles.logoutText}>
              Logout
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, selected && styles.tabItemActive]}
              >
                <Text size="sm" bold style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.feedCard}>
          <Text size="lg" bold style={styles.feedTitle}>
            {tabs.find((tab) => tab.key === activeTab)?.label}
          </Text>
          <Text size="sm" style={styles.feedDescription}>
            {activeTab === 'opinions'
              ? 'Your opinions and thoughts.'
              : activeTab === 'replies'
              ? 'Debates this user has joined.'
              : activeTab === 'highlights'
              ? 'Pinned highlights and featured posts.'
              : activeTab === 'articles'
              ? 'Long-form content and articles.'
              : 'Images, videos, and media attachments.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cover: {
    height: 180,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 18,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: -20,
  },
  avatarFrame: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#050505',
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#050505',
    position: 'absolute',
    right: -50,
    bottom: -8,
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  nameRow: {
    flex: 1,
    right: -50,
  },
  userName: {
    color: '#fff',
  },
  userHandle: {
    color: '#9ca3af',
    marginTop: 4,
  },
  bioText: {
    color: '#d1d5db',
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  statLabel: {
    color: '#9ca3af',
    marginTop: 4,
  },
  tabRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  tabItemActive: {
    backgroundColor: '#2563eb',
  },
  tabLabel: {
    color: '#d1d5db',
  },
  logoutButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#f3f4f6',
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#fff',
  },
  feedCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 20,
  },
  feedTitle: {
    color: '#fff',
    marginBottom: 10,
  },
  feedDescription: {
    color: '#9ca3af',
    lineHeight: 22,
  },
});
