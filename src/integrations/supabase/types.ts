export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_snapshots: {
        Row: {
          balance: number | null
          created_at: string
          currency: string | null
          daily_pnl: number | null
          equity: number | null
          free_margin: number | null
          id: string
          login: number | null
          margin: number | null
          margin_level: number | null
          max_drawdown: number | null
          open_positions: number | null
          profit: number | null
          profit_factor: number | null
          raw_payload: Json | null
          server: string | null
          snapshot_time: string | null
          total_pnl: number | null
          total_trades: number | null
          trades_today: number | null
          win_rate: number | null
        }
        Insert: {
          balance?: number | null
          created_at?: string
          currency?: string | null
          daily_pnl?: number | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          login?: number | null
          margin?: number | null
          margin_level?: number | null
          max_drawdown?: number | null
          open_positions?: number | null
          profit?: number | null
          profit_factor?: number | null
          raw_payload?: Json | null
          server?: string | null
          snapshot_time?: string | null
          total_pnl?: number | null
          total_trades?: number | null
          trades_today?: number | null
          win_rate?: number | null
        }
        Update: {
          balance?: number | null
          created_at?: string
          currency?: string | null
          daily_pnl?: number | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          login?: number | null
          margin?: number | null
          margin_level?: number | null
          max_drawdown?: number | null
          open_positions?: number | null
          profit?: number | null
          profit_factor?: number | null
          raw_payload?: Json | null
          server?: string | null
          snapshot_time?: string | null
          total_pnl?: number | null
          total_trades?: number | null
          trades_today?: number | null
          win_rate?: number | null
        }
        Relationships: []
      }
      ai_decisions: {
        Row: {
          blocked_reason: string | null
          confidence: number | null
          created_at: string
          decision: string | null
          entry: number | null
          id: string
          kelly_fraction: number | null
          lot_size: number | null
          market_state: string | null
          markov_probability: number | null
          raw_payload: Json | null
          reason: string | null
          risk_status: string | null
          signal: string | null
          sl: number | null
          strategy: string | null
          symbol: string | null
          timeframe: string | null
          tp: number | null
        }
        Insert: {
          blocked_reason?: string | null
          confidence?: number | null
          created_at?: string
          decision?: string | null
          entry?: number | null
          id?: string
          kelly_fraction?: number | null
          lot_size?: number | null
          market_state?: string | null
          markov_probability?: number | null
          raw_payload?: Json | null
          reason?: string | null
          risk_status?: string | null
          signal?: string | null
          sl?: number | null
          strategy?: string | null
          symbol?: string | null
          timeframe?: string | null
          tp?: number | null
        }
        Update: {
          blocked_reason?: string | null
          confidence?: number | null
          created_at?: string
          decision?: string | null
          entry?: number | null
          id?: string
          kelly_fraction?: number | null
          lot_size?: number | null
          market_state?: string | null
          markov_probability?: number | null
          raw_payload?: Json | null
          reason?: string | null
          risk_status?: string | null
          signal?: string | null
          sl?: number | null
          strategy?: string | null
          symbol?: string | null
          timeframe?: string | null
          tp?: number | null
        }
        Relationships: []
      }
      bot_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          level: string | null
          message: string
          raw_payload: Json | null
          source: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string | null
          message: string
          raw_payload?: Json | null
          source?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string | null
          message?: string
          raw_payload?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      bot_status: {
        Row: {
          allow_live_trading: boolean | null
          bot_name: string | null
          component: string
          demo_trading: boolean | null
          id: string
          last_heartbeat: string | null
          latency_ms: number | null
          magic_number: number | null
          meta: Json | null
          mode: string | null
          paper_trading: boolean | null
          raw_payload: Json | null
          read_only: boolean | null
          status: string
          symbols: Json | null
          updated_at: string
          uptime: string | null
        }
        Insert: {
          allow_live_trading?: boolean | null
          bot_name?: string | null
          component?: string
          demo_trading?: boolean | null
          id?: string
          last_heartbeat?: string | null
          latency_ms?: number | null
          magic_number?: number | null
          meta?: Json | null
          mode?: string | null
          paper_trading?: boolean | null
          raw_payload?: Json | null
          read_only?: boolean | null
          status: string
          symbols?: Json | null
          updated_at?: string
          uptime?: string | null
        }
        Update: {
          allow_live_trading?: boolean | null
          bot_name?: string | null
          component?: string
          demo_trading?: boolean | null
          id?: string
          last_heartbeat?: string | null
          latency_ms?: number | null
          magic_number?: number | null
          meta?: Json | null
          mode?: string | null
          paper_trading?: boolean | null
          raw_payload?: Json | null
          read_only?: boolean | null
          status?: string
          symbols?: Json | null
          updated_at?: string
          uptime?: string | null
        }
        Relationships: []
      }
      execution_events: {
        Row: {
          created_at: string
          decision: string | null
          event_type: string | null
          id: string
          lot: number | null
          magic: number | null
          magic_number: number | null
          mode: string | null
          payload: Json | null
          price: number | null
          raw_payload: Json | null
          result: string | null
          side: string | null
          symbol: string | null
        }
        Insert: {
          created_at?: string
          decision?: string | null
          event_type?: string | null
          id?: string
          lot?: number | null
          magic?: number | null
          magic_number?: number | null
          mode?: string | null
          payload?: Json | null
          price?: number | null
          raw_payload?: Json | null
          result?: string | null
          side?: string | null
          symbol?: string | null
        }
        Update: {
          created_at?: string
          decision?: string | null
          event_type?: string | null
          id?: string
          lot?: number | null
          magic?: number | null
          magic_number?: number | null
          mode?: string | null
          payload?: Json | null
          price?: number | null
          raw_payload?: Json | null
          result?: string | null
          side?: string | null
          symbol?: string | null
        }
        Relationships: []
      }
      hermes_agents: {
        Row: {
          active_symbol: string | null
          confidence: number | null
          display_name: string | null
          id: string
          last_update: string | null
          latest_signal: string | null
          magic_number: number | null
          meta: Json | null
          mode: string | null
          name: string
          pnl_today: number | null
          raw_payload: Json | null
          status: string | null
          symbol: string | null
          symbols: Json | null
          tag: string | null
          timeframe: string | null
          updated_at: string
        }
        Insert: {
          active_symbol?: string | null
          confidence?: number | null
          display_name?: string | null
          id?: string
          last_update?: string | null
          latest_signal?: string | null
          magic_number?: number | null
          meta?: Json | null
          mode?: string | null
          name: string
          pnl_today?: number | null
          raw_payload?: Json | null
          status?: string | null
          symbol?: string | null
          symbols?: Json | null
          tag?: string | null
          timeframe?: string | null
          updated_at?: string
        }
        Update: {
          active_symbol?: string | null
          confidence?: number | null
          display_name?: string | null
          id?: string
          last_update?: string | null
          latest_signal?: string | null
          magic_number?: number | null
          meta?: Json | null
          mode?: string | null
          name?: string
          pnl_today?: number | null
          raw_payload?: Json | null
          status?: string | null
          symbol?: string | null
          symbols?: Json | null
          tag?: string | null
          timeframe?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kelly_risk: {
        Row: {
          blocked_reason: string | null
          created_at: string
          daily_loss_pct: number | null
          drawdown_pct: number | null
          edge: number | null
          final_risk: number | null
          fractional_kelly: number | null
          id: string
          kelly_fraction: number | null
          lot_size: number | null
          max_daily_loss: number | null
          max_drawdown: number | null
          max_risk_per_trade: number | null
          model_probability: number | null
          open_hermes_trades: number | null
          probability: number | null
          raw_payload: Json | null
          reward_risk: number | null
          status: string | null
          symbol: string | null
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          daily_loss_pct?: number | null
          drawdown_pct?: number | null
          edge?: number | null
          final_risk?: number | null
          fractional_kelly?: number | null
          id?: string
          kelly_fraction?: number | null
          lot_size?: number | null
          max_daily_loss?: number | null
          max_drawdown?: number | null
          max_risk_per_trade?: number | null
          model_probability?: number | null
          open_hermes_trades?: number | null
          probability?: number | null
          raw_payload?: Json | null
          reward_risk?: number | null
          status?: string | null
          symbol?: string | null
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          daily_loss_pct?: number | null
          drawdown_pct?: number | null
          edge?: number | null
          final_risk?: number | null
          fractional_kelly?: number | null
          id?: string
          kelly_fraction?: number | null
          lot_size?: number | null
          max_daily_loss?: number | null
          max_drawdown?: number | null
          max_risk_per_trade?: number | null
          model_probability?: number | null
          open_hermes_trades?: number | null
          probability?: number | null
          raw_payload?: Json | null
          reward_risk?: number | null
          status?: string | null
          symbol?: string | null
        }
        Relationships: []
      }
      market_candles: {
        Row: {
          broker_symbol: string | null
          candle_time: string
          close: number
          created_at: string
          high: number
          id: string
          low: number
          open: number
          raw_payload: Json | null
          spread: number | null
          symbol: string
          tick_volume: number | null
          timeframe: string
        }
        Insert: {
          broker_symbol?: string | null
          candle_time: string
          close: number
          created_at?: string
          high: number
          id?: string
          low: number
          open: number
          raw_payload?: Json | null
          spread?: number | null
          symbol: string
          tick_volume?: number | null
          timeframe: string
        }
        Update: {
          broker_symbol?: string | null
          candle_time?: string
          close?: number
          created_at?: string
          high?: number
          id?: string
          low?: number
          open?: number
          raw_payload?: Json | null
          spread?: number | null
          symbol?: string
          tick_volume?: number | null
          timeframe?: string
        }
        Relationships: []
      }
      market_states: {
        Row: {
          atr: number | null
          created_at: string
          ema20: number | null
          ema200: number | null
          ema50: number | null
          id: string
          price: number | null
          raw_payload: Json | null
          rsi: number | null
          session: string | null
          spread: number | null
          state: string
          symbol: string
          timeframe: string
          trend: string | null
          volatility: number | null
        }
        Insert: {
          atr?: number | null
          created_at?: string
          ema20?: number | null
          ema200?: number | null
          ema50?: number | null
          id?: string
          price?: number | null
          raw_payload?: Json | null
          rsi?: number | null
          session?: string | null
          spread?: number | null
          state: string
          symbol: string
          timeframe: string
          trend?: string | null
          volatility?: number | null
        }
        Update: {
          atr?: number | null
          created_at?: string
          ema20?: number | null
          ema200?: number | null
          ema50?: number | null
          id?: string
          price?: number | null
          raw_payload?: Json | null
          rsi?: number | null
          session?: string | null
          spread?: number | null
          state?: string
          symbol?: string
          timeframe?: string
          trend?: string | null
          volatility?: number | null
        }
        Relationships: []
      }
      markov_predictions: {
        Row: {
          confidence: number | null
          created_at: string
          current_state: string
          id: string
          persistence: number | null
          persistence_bars: number | null
          predicted_next_state: string | null
          predicted_state: string | null
          probability: number
          raw_payload: Json | null
          signal: string | null
          symbol: string
          timeframe: string
          transition_count: number | null
          transitions: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          current_state: string
          id?: string
          persistence?: number | null
          persistence_bars?: number | null
          predicted_next_state?: string | null
          predicted_state?: string | null
          probability: number
          raw_payload?: Json | null
          signal?: string | null
          symbol: string
          timeframe: string
          transition_count?: number | null
          transitions?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          current_state?: string
          id?: string
          persistence?: number | null
          persistence_bars?: number | null
          predicted_next_state?: string | null
          predicted_state?: string | null
          probability?: number
          raw_payload?: Json | null
          signal?: string | null
          symbol?: string
          timeframe?: string
          transition_count?: number | null
          transitions?: number | null
        }
        Relationships: []
      }
      nightly_reports: {
        Row: {
          best_session: string | null
          best_setup: string | null
          created_at: string
          id: string
          payload: Json | null
          raw_payload: Json | null
          report_date: string
          status: string | null
          suggestion: string | null
          summary: string | null
          trades_reviewed: number | null
          worst_setup: string | null
        }
        Insert: {
          best_session?: string | null
          best_setup?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          raw_payload?: Json | null
          report_date: string
          status?: string | null
          suggestion?: string | null
          summary?: string | null
          trades_reviewed?: number | null
          worst_setup?: string | null
        }
        Update: {
          best_session?: string | null
          best_setup?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          raw_payload?: Json | null
          report_date?: string
          status?: string | null
          suggestion?: string | null
          summary?: string | null
          trades_reviewed?: number | null
          worst_setup?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      strategy_signals: {
        Row: {
          blocked_reason: string | null
          confidence: number | null
          created_at: string
          entry: number | null
          id: string
          pnl: number | null
          raw_payload: Json | null
          reason: string | null
          signal: string | null
          sl: number | null
          status: string | null
          strategy: string
          symbol: string | null
          timeframe: string | null
          tp: number | null
          win_rate: number | null
        }
        Insert: {
          blocked_reason?: string | null
          confidence?: number | null
          created_at?: string
          entry?: number | null
          id?: string
          pnl?: number | null
          raw_payload?: Json | null
          reason?: string | null
          signal?: string | null
          sl?: number | null
          status?: string | null
          strategy: string
          symbol?: string | null
          timeframe?: string | null
          tp?: number | null
          win_rate?: number | null
        }
        Update: {
          blocked_reason?: string | null
          confidence?: number | null
          created_at?: string
          entry?: number | null
          id?: string
          pnl?: number | null
          raw_payload?: Json | null
          reason?: string | null
          signal?: string | null
          sl?: number | null
          status?: string | null
          strategy?: string
          symbol?: string | null
          timeframe?: string | null
          tp?: number | null
          win_rate?: number | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          closed_at: string | null
          confidence: number | null
          created_at: string
          dir: string
          entry: number | null
          id: string
          lot: number | null
          lot_size: number | null
          magic: number | null
          magic_number: number | null
          opened_at: string | null
          pnl: number | null
          raw_payload: Json | null
          reason: string | null
          result: string | null
          signal: string | null
          sl: number | null
          strategy: string | null
          symbol: string
          ticket: number | null
          tp: number | null
        }
        Insert: {
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          dir: string
          entry?: number | null
          id?: string
          lot?: number | null
          lot_size?: number | null
          magic?: number | null
          magic_number?: number | null
          opened_at?: string | null
          pnl?: number | null
          raw_payload?: Json | null
          reason?: string | null
          result?: string | null
          signal?: string | null
          sl?: number | null
          strategy?: string | null
          symbol: string
          ticket?: number | null
          tp?: number | null
        }
        Update: {
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          dir?: string
          entry?: number | null
          id?: string
          lot?: number | null
          lot_size?: number | null
          magic?: number | null
          magic_number?: number | null
          opened_at?: string | null
          pnl?: number | null
          raw_payload?: Json | null
          reason?: string | null
          result?: string | null
          signal?: string | null
          sl?: number | null
          strategy?: string | null
          symbol?: string
          ticket?: number | null
          tp?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hermes_table_columns: { Args: { _table_name: string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
