import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

export async function getUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function requireAuth(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function resetPassword(email: string) {
  // Garantir que estamos no cliente
  if (typeof window === 'undefined') {
    throw new Error('resetPassword só pode ser chamado no cliente');
  }

  const redirectUrl = `${window.location.origin}/reset-password`;
  
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}







