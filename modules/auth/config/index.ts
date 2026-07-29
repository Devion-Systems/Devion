import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor, admin, organization   } from "better-auth/plugins";

import { env } from "@repo/env";
import { db } from "@repo/storage";
import { sendEmail } from './email/email.js';

export const auth = betterAuth({
    database: drizzleAdapter(db,{
        provider: "pg",
    }),
    appName: "Devion",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: "http://localhost:3000",
    user: {
        changeEmail: {
            enabled: true,
        },
        deleteUser: { 
            enabled: true,
            beforeDelete: async (user, request) => {
                if (user.email.includes("admin")) {
                    throw new APIError("BAD_REQUEST", {
                        message: "Admin accounts can't be deleted",
                    });
                }
            },
            sendDeleteAccountVerification: async (
                {
                    user,   // The user object
                    url, // The auto-generated URL for deletion
                    token  // The verification token  (can be used to generate custom URL)
                },
                request  // The original request object (optional)
            ) => {
                // Your email sending logic here
                // Example: sendEmail(data.user.email, "Verify Deletion", data.url);
            },
        } 
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url, token }, request) => {
            void sendEmail({
                to: user.email,
                subject: 'Verify your email address',
                text: `Click the link to verify your email: ${url}`
            })
        },
        sendOnSignUp: true
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        autoSignInAfterVerification: true,
        sendResetPassword: async ({ user, url, token }, request) => {
            void sendEmail({
                to: user.email,
                subject: 'Reset your password',
                text: `Click the link to reset your password: ${url}`
            })
        },
        onExistingUserSignUp: async ({ user }, request) => {
          void sendEmail({
              to: user.email,
              subject: "Sign-up attempt with your email",
              text: "Someone tried to create an account using your email address. If this was you, try signing in instead. If not, you can safely ignore this email.",
         });
    },
    },
    rateLimit: {
        enabled: true,
        window: 10, // time window in seconds
        max: 100, // max requests in the window
    },
     advanced: {
        ipAddress: {
          ipAddressHeaders: ["x-real-ip"],
           ipv6Subnet: 56,
      },
    },
    plugins:[
      twoFactor(),
      admin(),
      organization() 
    ]
});