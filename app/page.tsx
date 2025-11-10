'use client';
import React, { useMemo } from "react";
import { Amplify } from "aws-amplify";
import { signOut } from "aws-amplify/auth";

import { Button, withAuthenticator } from "@aws-amplify/ui-react";
import {
  createStorageBrowser,
  createAmplifyAuthAdapter,
  elementsDefault,
} from "@aws-amplify/ui-react-storage/browser";
import "@aws-amplify/ui-react-storage/styles.css";
import "@aws-amplify/ui-react-storage/storage-browser-styles.css";

import config from "../amplify_outputs.json";

Amplify.configure(config);

const DefaultButton = elementsDefault.Button;
const bucketName = (
  config as { storage?: { bucket_name?: string } }
).storage?.bucket_name ?? "";

const formatStorageLabel = (value: string): string => {
  if (value === "Home") {
    return value;
  }

  let result = value;

  if (bucketName) {
    const bucketPrefix = `${bucketName}/`;
    if (result.startsWith(bucketPrefix)) {
      result = result.slice(bucketPrefix.length);
    } else if (result === bucketName) {
      result = "";
    }
  }

  result = result.replace(/^s3:\/\/[^/]+\/?/, "");
  result = result.replace(/\*$/, "");
  result = result.replace(/^\/+/, "").replace(/\/+$/, "");

  return result;
};

const CustomButton = (
  props: React.ComponentProps<typeof DefaultButton>
) => {
  const { children, ...rest } = props;
  let nextChildren: React.ReactNode = children;

  if (typeof children === "string") {
    if (props.variant === "table-data") {
      nextChildren = formatStorageLabel(children);
    } else if (props.variant === "navigate") {
      nextChildren = formatStorageLabel(children);
    }
  }

  return <DefaultButton {...rest}>{nextChildren}</DefaultButton>;
};

const DefaultSpan = elementsDefault.Span;

const CustomSpan = (
  props: React.ComponentProps<typeof DefaultSpan>
) => {
  const { children, variant, ...rest } = props;
  let nextChildren: React.ReactNode = children;

  if (variant === "navigate-current" && typeof children === "string") {
    const formatted = formatStorageLabel(children);
    nextChildren = formatted || "";
  }

  return (
    <DefaultSpan {...rest} variant={variant}>
      {nextChildren}
    </DefaultSpan>
  );
};

const customElements = {
  ...elementsDefault,
  Button: CustomButton,
  Span: CustomSpan,
};

function Example() {
  const { StorageBrowser } = useMemo(() => {
    return createStorageBrowser({
      elements: customElements,
      config: createAmplifyAuthAdapter(),
    });
  }, []);

  return (
    <>
      <Button
        marginBlockEnd="xl"
        size="small"
        onClick={() => {
          signOut();
        }}
      >
        Sign Out
      </Button>
      <StorageBrowser />
    </>
  );
}

export default withAuthenticator(Example);
