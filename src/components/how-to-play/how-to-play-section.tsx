import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Text } from '~/components/ui';
import type { HowToPlaySection as Section } from '~/lib/content/how-to-play-content';

export function HowToPlaySection({ title, body }: Section): React.JSX.Element {
  return (
    <Card className='w-full mb-4 rounded-2xl'>
      <CardHeader>
        <CardTitle className='text-lg'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Text className='text-muted-foreground'>{body}</Text>
      </CardContent>
    </Card>
  );
}
