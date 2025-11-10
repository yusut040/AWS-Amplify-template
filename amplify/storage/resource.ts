import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "storage-browser-test",
  access: (allow: any) => ({
    'Test1/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'Test2/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'Test3/*': [allow.authenticated.to(['read', 'write', 'delete'])]
  })
});
