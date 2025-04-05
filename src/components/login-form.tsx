import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';
import { Text } from '@/components/ui/text';

const schema = z.object({
  name: z.string().optional(),
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Invalid email format'),
  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(6, 'Password must be at least 6 characters'),
});

export type FormType = z.infer<typeof schema>;

export type LoginFormProps = {
  onSubmit?: SubmitHandler<FormType>;
};

export const LoginForm = ({ onSubmit = () => {} }: LoginFormProps) => {
  const { handleSubmit, control } = useForm<FormType>({
    resolver: zodResolver(schema),
  });
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={10}
    >
      <View className="justify-center flex-1 p-4">
        <Text className="pb-6 text-4xl font-bold text-center">Sign In</Text>

        <Text className="max-w-xs mb-6 text-center text-gray-500">
          Welcome! 👋 This is a demo login screen! Feel free to use any email
          and password to sign in and try it out.
        </Text>
      </View>
      {/* <View className="justify-center flex-1 p-4">
        <View className="items-center justify-center">
          <Text
            testID="form-title"
            className="pb-6 text-4xl font-bold text-center"
          >
            Sign In
          </Text>

          <Text className="max-w-xs mb-6 text-center text-gray-500">
            Welcome! 👋 This is a demo login screen! Feel free to use any email
            and password to sign in and try it out.
          </Text>
        </View>

        <ControlledInput
          testID="name"
          control={control}
          name="name"
          label="Name"
        />

        <ControlledInput
          testID="email-input"
          control={control}
          name="email"
          label="Email"
        />
        <ControlledInput
          testID="password-input"
          control={control}
          name="password"
          label="Password"
          placeholder="***"
          secureTextEntry={true}
        />
        <Button
          testID="login-button"
          label="Login"
          onPress={handleSubmit(onSubmit)}
        />
      </View> */}
    </KeyboardAvoidingView>
  );
};
