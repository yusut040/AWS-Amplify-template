'use client';
import React, { useMemo } from "react";
import { Amplify } from "aws-amplify";
import { signOut } from "aws-amplify/auth";
import { fetchAuthSession } from "aws-amplify/auth";
import { list } from "aws-amplify/storage";

import { Button, withAuthenticator } from "@aws-amplify/ui-react";
import {
  createStorageBrowser,
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

// Storage Browser用のカスタムconfig実装
// バケット名とリージョンをamplify_outputs.jsonから取得
const bucketConfig = {
  bucket: (config as { storage?: { bucket_name?: string } }).storage?.bucket_name ?? "",
  region: (config as { storage?: { aws_region?: string } }).storage?.aws_region ?? "",
};

/**
 * listLocations: Storage Browserのロケーション一覧を動的に生成する関数
 * 
 * 【役割】
 * - S3の`public/`配下にあるフォルダ（企業フォルダ）を自動検出
 * - 各フォルダをStorage Browserの「ロケーション」として返す
 * 
 * 【引数】
 * - input.pageSize: 1ページあたりの最大ロケーション数（オプション）
 * - input.nextToken: ページネーション用トークン（オプション）
 * 
 * 【戻り値】
 * - items: ロケーションの配列
 *   - id: ロケーションの一意識別子（フルパス）
 *   - bucket: S3バケット名
 *   - prefix: S3プレフィックス（例: "public/企業A/"）
 *   - permissions: ユーザーが実行可能な操作 ['delete', 'get', 'list', 'write']
 *   - type: ロケーションタイプ（'PREFIX' = フォルダ, 'BUCKET' = バケットルート）
 * - nextToken: 次ページがある場合のトークン（未実装）
 * 
 * 【処理フロー】
 * 1. Amplify Storage APIの`list()`を使用してS3を検索
 * 2. `path: 'public/'` で public/ 配下を対象に指定
 * 3. `subpathStrategy: { strategy: 'exclude' }` でサブフォルダのみを取得
 * 4. 取得した各フォルダをLocationDataに変換
 */
/**
 * listLocations: Storage Browserのロケーション一覧を動的に生成する関数
 * 
 * 【役割】
 * - S3の`public/`配下にあるフォルダ（企業フォルダ）を自動検出
 * - 各フォルダをStorage Browserの「ロケーション」として返す
 * 
 * 【引数】
 * - input.pageSize: 1ページあたりの最大ロケーション数（オプション）
 * - input.nextToken: ページネーション用トークン（オプション）
 * 
 * 【戻り値】
 * - locations: ロケーションアクセス情報の配列
 *   - id: ロケーションの一意識別子
 *   - scope: S3リソースのスコープ（バケット名/プレフィックス）
 *   - permission: ユーザー権限レベル（READ, WRITE, DELETE, READ_WRITE, WRITE_DELETE, FULL）
 *   - type: ロケーションタイプ（'PREFIX' = フォルダ, 'BUCKET' = バケットルート）
 * - nextToken: 次ページがある場合のトークン（未実装）
 * 
 * 【処理フロー】
 * 1. Amplify Storage APIの`list()`を使用してS3を検索
 * 2. `path: 'public/'` で public/ 配下を対象に指定
 * 3. `subpathStrategy: { strategy: 'exclude' }` でサブフォルダのみを取得
 * 4. 取得した各フォルダをLocationAccessに変換
 * 
 * 【Storage Browserの権限モデル】
 * - READ: ファイルの一覧表示とダウンロード
 * - WRITE: ファイルのアップロード
 * - DELETE: ファイルの削除
 * - READ_WRITE: READ + WRITE
 * - WRITE_DELETE: WRITE + DELETE
 * - FULL: すべての操作（READ + WRITE + DELETE）
 */
const listLocations = async (input = {}) => {
  console.log('========================================');
  console.log('listLocations が呼ばれました');
  console.log('バケット設定:', bucketConfig);
  console.log('========================================');
  
  try {
    // Amplify Storage APIでS3の`public/`配下のフォルダ一覧を取得
    console.log('S3のpublic/配下を検索中...');
    const result = await list({
      path: 'public/',
      options: {
        // subpathStrategy: 'exclude' → サブフォルダ（ディレクトリ）のみを取得
        // ファイルは除外される
        subpathStrategy: { strategy: 'exclude' },
        // リスト取得の最大件数（デフォルト1000件）
        listAll: true,
      },
    });
    //test
    console.log('S3検索結果:', result);
    console.log('excludedSubpaths:', result.excludedSubpaths);
    console.log('items:', result.items);

    // 取得したサブフォルダをStorage Browserのitems形式に変換
    // 公式ドキュメント通り: { items: [...], nextToken: ... } を返す
    const items = (result.excludedSubpaths ?? []).map((subpath) => {
      // subpathの例: "public/企業A/"
      
      console.log(`フォルダ検出: ${subpath} -> バケット: ${bucketConfig.bucket}, プレフィックス: ${subpath}`);
      
      return {
        // 一意識別子としてフルパスを使用
        id: `${bucketConfig.bucket}/${subpath}`,
        // S3バケット名
        bucket: bucketConfig.bucket,
        // S3プレフィックス（フォルダパス）
        prefix: subpath,
        // permissions: 配列形式で複数の権限を指定
        // ['delete', 'get', 'list', 'write'] = すべての操作が可能
        permissions: ['delete', 'get', 'list', 'write'] as const,
        // PREFIXは特定のフォルダ（プレフィックス）を表す
        // BUCKETはバケット全体へのアクセスを表す
        type: 'PREFIX' as const,
      };
    });

    console.log('返却するアイテム数:', items.length);
    console.log('アイテム一覧:', items);
    console.log('========================================');

    return {
      items: items,
      // ページネーションが必要な場合はnextTokenを実装
      // 今回は全件取得なので未定義
      nextToken: undefined,
    };
  } catch (error) {
    console.error('❌ listLocationsでエラー発生:', error);
    // エラー時は空のitems配列を返す
    return {
      items: [],
      nextToken: undefined,
    };
  }
};

/**
 * getLocationCredentials: 指定されたロケーションへのアクセス用の認証情報を取得
 * 
 * 【役割】
 * - Storage BrowserがS3にアクセスする際に必要な一時的なAWS認証情報を提供
 * - Amplify Authから取得したセッション情報を使用
 * 
 * 【引数】
 * - input.scope: アクセス対象のS3スコープ（バケット名/プレフィックス形式）
 * - input.permission: 実行する操作の権限レベル（READ, WRITE, DELETE等）
 * 
 * 【戻り値】
 * - credentials: AWS認証情報
 *   - accessKeyId: アクセスキーID
 *   - secretAccessKey: シークレットアクセスキー
 *   - sessionToken: セッショントークン
 *   - expiration: 認証情報の有効期限
 * 
 * 【処理フロー】
 * 1. fetchAuthSession()でAmplify Authから現在のセッションを取得
 * 2. セッション内の認証情報を抽出
 * 3. Storage Browserが期待する形式で返す
 * 
 * 【注意】
 * - 型はany使用して柔軟に対応（Storage Browserの内部型定義に依存）
 */
const getLocationCredentials = async (input: any) => {
  console.log('🔐 getLocationCredentials が呼ばれました');
  console.log('入力パラメータ:', input);
  
  // Amplify Authからセッション情報を取得
  // このセッションにはCognitoから発行されたAWS一時認証情報が含まれる
  const session = await fetchAuthSession();
  
  console.log('セッション取得完了:', {
    hasCredentials: !!session.credentials,
    hasSessionToken: !!session.credentials?.sessionToken,
  });
  
  // 認証情報が存在しない場合はエラー
  if (!session.credentials) {
    throw new Error('No credentials available');
  }

  // sessionTokenが存在しない場合もエラー
  if (!session.credentials.sessionToken) {
    throw new Error('No session token available');
  }

  // Storage Browserが期待する形式で認証情報を返す
  const result = {
    credentials: {
      accessKeyId: session.credentials.accessKeyId,
      secretAccessKey: session.credentials.secretAccessKey,
      sessionToken: session.credentials.sessionToken,
      // 有効期限をDateオブジェクトに変換
      expiration: session.credentials.expiration 
        ? new Date(session.credentials.expiration)
        : new Date(Date.now() + 3600000), // デフォルト1時間後
    },
  };
  
  console.log('認証情報返却完了');
  return result;
};

/**
 * registerAuthListener: 認証状態の変更を監視するリスナーを登録
 * 
 * 【役割】
 * - ユーザーのログアウトや認証状態の変更を検知
 * - Storage Browserに変更を通知し、内部状態をクリア
 * 
 * 【引数】
 * - onAuthStateChange: 認証状態が変更された時に呼び出すコールバック関数
 * 
 * 【処理】
 * - Amplify HubでAuth関連イベントをリッスン
 * - signOutイベントを検知したらonAuthStateChangeを呼び出す
 */
const registerAuthListener = (onAuthStateChange: () => void) => {
  // Amplify HubでAuth関連イベントを購読
  const { Hub } = require('aws-amplify/utils');
  
  Hub.listen('auth', (data: any) => {
    // ユーザーがサインアウトした場合
    if (data.payload.event === 'signedOut') {
      // Storage Browserに状態変更を通知
      // これによりStorage Browserが保持している認証情報やキャッシュがクリアされる
      onAuthStateChange();
    }
  });
};

function Example() {
  const { StorageBrowser } = useMemo(() => {
    return createStorageBrowser({
      elements: customElements,
      // カスタムconfigを使用してStorage Browserを初期化
      config: {
        // AWSリージョン（amplify_outputs.jsonから取得）
        region: bucketConfig.region,
        // デフォルトのAWSアカウントID（オプション）
        // accountId: 'XXXXXXXXXXXX',
        
        // ロケーション一覧取得関数（any型でバイパス）
        listLocations: listLocations as any,
        
        // 認証情報取得関数
        getLocationCredentials,
        
        // 認証状態監視リスナー登録関数
        registerAuthListener,
      },
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
