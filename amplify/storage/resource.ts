import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "storage-browser-test",
  access: (allow: any) => ({
    'public/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  }),
});
