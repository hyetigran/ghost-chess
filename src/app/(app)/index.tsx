import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export default function Index() {
  console.log('index');
  return (
    <View className="justify-center flex-1 p-4">
      <Text className="pb-6 text-4xl font-bold text-center">Sign In</Text>
    </View>
  );
}
