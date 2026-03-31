import type {
  BookingLocation,
  BookingSize,
} from "@/lib/supabase/database.types";

const DEFAULT_DEPOSITS: Record<BookingLocation, Record<BookingSize, number>> = {
  malmo: {
    small: 300,
    medium: 300,
    large: 500,
    xlarge: 500,
  },
  copenhagen: {
    small: 200,
    medium: 200,
    large: 350,
    xlarge: 350,
  },
};

export function getDefaultDepositAmount(
  location: BookingLocation,
  size: BookingSize
): number {
  return DEFAULT_DEPOSITS[location][size];
}

export function getDepositCurrency(location: BookingLocation): "SEK" | "DKK" {
  return location === "copenhagen" ? "DKK" : "SEK";
}
