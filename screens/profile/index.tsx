import {SafeAreaView} from 'react-native';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useAuth } from '@/providers/AuthProvider';



export default () =>{
  const{logOut} = useAuth();
  return (
    <SafeAreaView>
        <Text>Profile</Text>
        <Button onPress={logOut}>
          <ButtonText>LogOut</ButtonText>
        </Button>  
    </SafeAreaView>
  );
}