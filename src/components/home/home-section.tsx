import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui';

type Props = {
  title: string;
  children: React.ReactNode;
};

export function HomeSection({ title, children }: Props): React.JSX.Element {
  return (
    <Card className='w-full mb-5 rounded-2xl'>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
