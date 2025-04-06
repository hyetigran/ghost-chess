-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE public.users (
    id uuid references auth.users on delete cascade not null primary key,
    username text unique not null,
    email text,
    wins integer default 0 not null,
    losses integer default 0 not null,
    draws integer default 0 not null,
    elo_rating integer default 1200 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create games table
CREATE TABLE public.games (
    id uuid default gen_random_uuid() primary key,
    white_player_id uuid references public.users not null,
    black_player_id uuid references public.users not null,
    settings jsonb not null,
    status text check (status in ('active', 'completed', 'abandoned')) not null,
    result text check (result in ('checkmate', 'stalemate', 'draw', 'abandoned', null)),
    current_turn text check (current_turn in ('white', 'black')) not null,
    fen text not null,
    pgn text not null,
    white_time_remaining integer not null,
    black_time_remaining integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create moves table
CREATE TABLE public.moves (
    id uuid default gen_random_uuid() primary key,
    game_id uuid references public.games on delete cascade not null,
    player_id uuid references public.users not null,
    move_number integer not null,
    move_text text not null,
    fen text not null,
    captured_piece text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_elo_rating ON public.users(elo_rating);

-- Create indexes for games table
CREATE INDEX idx_games_white_player ON public.games(white_player_id);
CREATE INDEX idx_games_black_player ON public.games(black_player_id);
CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_games_created_at ON public.games(created_at);

-- Create indexes for moves table
CREATE INDEX idx_moves_game ON public.moves(game_id);
CREATE INDEX idx_moves_player ON public.moves(player_id);
CREATE INDEX idx_moves_created_at ON public.moves(created_at);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own data"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can view their own games"
    ON public.games FOR SELECT
    USING (auth.uid() = white_player_id or auth.uid() = black_player_id);

CREATE POLICY "Users can create games"
    ON public.games FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = white_player_id or 
        auth.uid() = black_player_id
    );

CREATE POLICY "Users can update their own games"
    ON public.games FOR UPDATE
    USING (auth.uid() = white_player_id or auth.uid() = black_player_id);

CREATE POLICY "Users can view moves in their games"
    ON public.moves FOR SELECT
    USING (
        exists (
            SELECT 1 FROM public.games
            WHERE games.id = moves.game_id
            AND (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert moves in their games"
    ON public.moves FOR INSERT
    TO authenticated
    WITH CHECK (
        exists (
            SELECT 1 FROM public.games
            WHERE games.id = moves.game_id
            AND (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
        )
    );

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        username,
        email
    )
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'username',
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update ratings after game completion
CREATE OR REPLACE FUNCTION public.update_ratings_after_game()
RETURNS TRIGGER AS $$
DECLARE
    white_score FLOAT;
    black_score FLOAT;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        CASE NEW.result
            WHEN 'checkmate' THEN
                IF NEW.current_turn = 'white' THEN
                    white_score := 0;
                    black_score := 1;
                ELSE
                    white_score := 1;
                    black_score := 0;
                END IF;
            WHEN 'stalemate' THEN
                white_score := 0.5;
                black_score := 0.5;
            WHEN 'draw' THEN
                white_score := 0.5;
                black_score := 0.5;
            WHEN 'abandoned' THEN
                IF NEW.current_turn = 'white' THEN
                    white_score := 0;
                    black_score := 1;
                ELSE
                    white_score := 1;
                    black_score := 0;
                END IF;
            ELSE
                RETURN NEW;
        END CASE;

        UPDATE public.users
        SET
            wins = CASE
                WHEN id = NEW.white_player_id AND white_score = 1 THEN wins + 1
                WHEN id = NEW.black_player_id AND black_score = 1 THEN losses + 1
                ELSE wins
            END,
            losses = CASE
                WHEN id = NEW.white_player_id AND white_score = 0 THEN losses + 1
                WHEN id = NEW.black_player_id AND black_score = 0 THEN wins + 1
                ELSE losses
            END,
            draws = CASE
                WHEN white_score = 0.5 THEN draws + 1
                ELSE draws
            END,
            updated_at = NOW()
        WHERE id IN (NEW.white_player_id, NEW.black_player_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_game_completed
    AFTER UPDATE OF status ON public.games
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION public.update_ratings_after_game();
