import type { GameState, Move } from '~/types/game';
import { supabase } from '../supabase/client';

export const gameApi = {
  createGame: async (settings: GameState['settings']) => {
    const { data, error } = await supabase
      .from('games')
      .insert([settings])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getGame: async (gameId: string) => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) throw error;
    return data;
  },

  makeMove: async (gameId: string, move: Move) => {
    const { data, error } = await supabase
      .from('moves')
      .insert([{ game_id: gameId, ...move }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  abandonGame: async (
    gameId: string,
    abandoningPlayerColor: 'white' | 'black',
  ) => {
    const { data, error } = await supabase
      .from('games')
      .update({
        status: 'completed',
        result: 'abandoned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
