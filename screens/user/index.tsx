import User from '@/components/shared/user';
import { useUser } from '@/hooks/use-user';
import { useLocalSearchParams } from 'expo-router';

export default () =>{
  const {userId} = useLocalSearchParams();
  const {data: user} = useUser(userId as string);
  return (<User user={user} />);
}