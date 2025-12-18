import { CameraView, useCameraPermissions } from 'expo-camera';
import { Circle, CheckCircle } from 'lucide-react-native';
import { View, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';
import React from 'react';
import { router } from 'expo-router';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const [photo, setPhoto] = React.useState<string | null>(null);

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    const result = await cameraRef.current.takePictureAsync();
    setPhoto(result.uri);
    
  };

  const confirmPhoto = () => {
    if (!photo) return;

    router.push({
      pathname: '/post',
      params: {
        cameraPhotoUri: photo,
      },
    });
  };

  if (!permission?.granted) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (photo) {
    return (
      <View className="flex-1">
        <Image source={{ uri: photo as string }} className="flex-1" />
        <TouchableOpacity
          className="bg-white rounded-full p-2"
          onPress={confirmPhoto}
        >
          <CheckCircle size={75} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  return ( 
  <CameraView style={{flex: 1}} facing={'back'} ref={cameraRef}>
    <View className="flex-1 flex-row justify-end items-end" style={styles.buttonContainer}> 
      <TouchableOpacity style={styles.button} onPress= {takePhoto}> 
        <Circle size={75} color="white" /> 
      </TouchableOpacity> 
    </View> 
  </CameraView> );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    width: '100%',
    paddingHorizontal: 64,
  },
  button: {
    flex: 1,
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
