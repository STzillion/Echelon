import { Text } from '@/components/ui/text';
import { Platform, SafeAreaView, StyleSheet } from 'react-native';


export default () =>{
  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && styles.webColumn]}>
        <Text>Topics</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  webColumn: { width: '100%', maxWidth: 500, alignSelf: 'center' },
});