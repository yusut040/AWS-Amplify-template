import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "storage-browser-test",
  access: (allow: any) => ({
    'public/test1/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
    'public/test2/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
  }),
});
