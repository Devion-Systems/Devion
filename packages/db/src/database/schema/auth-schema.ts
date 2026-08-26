import {
  account,
  apikey,
  deviceCode,
  invitation,
  member,
  organization,
  passkey,
  session,
  team,
  teamMember,
  twoFactor,
  user,
  verification,
} from "./auth.js";

/**
 * Only the tables owned by Better Auth. Keeping this separate prevents API
 * feature tables from being accidentally interpreted as auth models.
 */
export const authSchema = {
  user,
  session,
  team,
  teamMember,
  account,
  verification,
  twoFactor,
  passkey,
  apikey,
  deviceCode,
  organization,
  member,
  invitation,
};
