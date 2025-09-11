import {Pressable, SafeAreaView} from 'react-native';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallbackText, AvatarImage, AvatarBadge } from '@/components/ui/avatar';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Images, Camera, Mic, VideoIcon, Hash } from 'lucide-react-native';
import { VStack } from '@/components/ui/vstack';
import { router } from 'expo-router';

export default () =>{
  const {user} = useAuth();
   return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.leftContainer}>
          <Image
            source={require('@/assets/images/EchelonLogo3d.png')} // Your logo path here
            style={styles.logo}
            resizeMode="contain"
          />
          
        </View>
      </View>

      {/* Body Content Placeholder */}
      <View style={styles.body}>
        <Pressable onPress={() =>{
          router.push('/post')
        }}>
          <HStack style = {styles.card} className='items-center px-5'>
            <Avatar size="md">
              <AvatarFallbackText>{user?.username}</AvatarFallbackText>
              <AvatarImage
                source={{
                  uri: "",
                }}
              />
            </Avatar>
            <Card size="md" className="m-3 bg-transparent">
              <VStack className='p-3' space='lg'>
                <VStack>
                  <Heading size="md" style= {styles.cardText} className="mb-1">
                    {user?.username}
                  </Heading>
                  <Text size="md" style= {styles.cardText}>Say something you wanna debate...</Text>
                </VStack>
                <HStack className='items-center' space='3xl'>
                  <Images size={24} color='white' strokeWidth={0.9}/>
                  <Camera size={24} color='white' strokeWidth={0.9}/>
                  <Mic size={24} color='white' strokeWidth={0.9}/>
                  <VideoIcon size={24} color='white' strokeWidth={0.9}/>
                  <Hash size={24} color='white' strokeWidth={0.9}/>
                </HStack>
              </VStack>
            </Card>
          </HStack>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f', // similar to your screenshot
  },
  cardText:
  {
    color: '#ffffffff'
  },
  card:
  {
    backgroundColor: '#0f0f0f',
    
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181818',
    paddingHorizontal: 156,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginRight: 1,
    
  },
  title: {
    color: '#7b5cff',
    fontSize: 18,
    fontWeight: '700',
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 30,
    backgroundColor: '#4b4b4b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    padding: 16,
  },
});
