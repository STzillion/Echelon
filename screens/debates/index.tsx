import { Text } from '@/components/ui/text';
import { Platform, SafeAreaView } from 'react-native';
import { createCompactStyleSheet } from '@/lib/compact-ui';


export default () =>{
  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && styles.webColumn]}>
        <Text>Debate Activity</Text>
    </SafeAreaView>
  );
}

const styles = createCompactStyleSheet({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  webColumn: { width: '100%', maxWidth: 500, alignSelf: 'center' },
});