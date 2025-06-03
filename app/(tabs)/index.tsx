import {SafeAreaView} from 'react-native';
import {HStack} from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';


export default function HomeScreen() {
  return (
    <SafeAreaView>
      <HStack className="justify-between">
        <Text className="text-2xl font-bold">Home</Text>
        <Text className="text-2xl font-bold">Test</Text>
      </HStack>
    </SafeAreaView>
  );
}
