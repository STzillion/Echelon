import {SafeAreaView} from 'react-native';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';
import { StyleSheet } from 'react-native';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallbackText, AvatarImage, AvatarBadge } from '@/components/ui/avatar';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Images, Camera, Mic, VideoIcon, Hash } from 'lucide-react-native';
import { VStack } from '@/components/ui/vstack';
import {Button, ButtonText } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';




export default () =>{
    const {user} = useAuth();
    const { v4: uuidv4 } = require('uuid');

    const onPress = async () =>{

      if(!user) return;
      console.log("Pressed")
      
      const{data, error} = await supabase.from('Post').insert({
        id: uuidv4(),
        user_id: user?.id,
        text: "hello world",
      
      }).select();
     
      console.log(data, error)
      if(!error) router.back()
    }
  return (
    <SafeAreaView style={styles.container}>
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
          <Button onPress = {onPress}>
            <ButtonText>Post</ButtonText>
          </Button>
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
});