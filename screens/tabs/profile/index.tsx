
import User from '@/components/shared/user';
import { useAuth } from '@/providers/AuthProvider';

export default () =>{
  const {user} = useAuth();
  return (<User user={user} />);
}