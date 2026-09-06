export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          user_id: string;
          occurred_on: string;
          merchant: string;
          amount_paise: number;
          currency: "INR";
          status: "confirmed" | "needs_review";
          notes: string | null;
        };
      };
    };
  };
};
