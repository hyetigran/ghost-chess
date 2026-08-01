import * as React from 'react';
import { View } from 'react-native';
import { Button, Input, Text } from '~/components/ui';
import { validateUsername } from '~/lib/user/validate-username';

type Props = {
  username: string;
  onSave: (username: string) => Promise<unknown>;
};

export function ProfileIdentityCard({
  username,
  onSave,
}: Props): React.JSX.Element {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(username);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const startEditing = (): void => {
    setDraft(username);
    setError(null);
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    const validation = validateUsername(draft);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      setError('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <View className='flex-row items-center justify-between'>
        <Text className='text-lg font-semibold'>{username}</Text>
        <Button variant='ghost' onPress={startEditing}>
          <Text>Edit</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className='gap-2'>
      <Input value={draft} onChangeText={setDraft} placeholder='Username' />
      {error && <Text className='text-sm text-red-500'>{error}</Text>}
      <View className='flex-row gap-2'>
        <Button
          variant='outline'
          className='flex-1'
          onPress={() => setEditing(false)}
        >
          <Text>Cancel</Text>
        </Button>
        <Button className='flex-1' disabled={saving} onPress={save}>
          <Text>Save</Text>
        </Button>
      </View>
    </View>
  );
}
