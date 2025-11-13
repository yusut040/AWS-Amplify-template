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
const DefaultSpan = elementsDefault.Span;
const bucketName = (
  config as { storage?: { bucket_name?: string } }
).storage?.bucket_name ?? "";

/**
 * formatStorageLabel: Storage Browserの表示ラベルをフォーマットする関数
 * 
 * 【役割】
 * - S3のバケット名やプレフィックスから表示用のラベルを生成
 * - 不要なプレフィックス（バケット名、s3://など）を削除
 * 
 * 【修正内容】
 * - デバッグログを追加して変換前後の値を出力
 * - "public/"プレフィックスの削除処理を追加
 */
const formatStorageLabel = (value: string): string => {
  console.log('🏷️ formatStorageLabel 呼び出し - 入力:', value);
  
  if (value === "Home") {
    console.log('🏷️ formatStorageLabel 出力: Home (変更なし)');
    return value;
  }

  let result = value;

  // バケット名のプレフィックスを削除
  if (bucketName) {
    const bucketPrefix = `${bucketName}/`;
    if (result.startsWith(bucketPrefix)) {
      result = result.slice(bucketPrefix.length);
      console.log('🏷️ バケットプレフィックス削除後:', result);
    } else if (result === bucketName) {
      result = "";
      console.log('🏷️ バケット名完全一致 - 空文字列に設定');
    }
  }

  // s3://プロトコルの削除
  result = result.replace(/^s3:\/\/[^/]+\/?/, "");
  console.log('🏷️ s3://プロトコル削除後:', result);
  
  // 末尾のワイルドカード削除
  result = result.replace(/\*$/, "");
  console.log('🏷️ ワイルドカード削除後:', result);
  
  // 先頭と末尾のスラッシュ削除
  result = result.replace(/^\/+/, "").replace(/\/+$/, "");
  console.log('🏷️ スラッシュ削除後:', result);
  
  // "public/"プレフィックスを削除（ユーザーにはフォルダ名のみを表示）
  if (result.startsWith('public/')) {
    result = result.slice(7); // "public/".length = 7
    console.log('🏷️ public/プレフィックス削除後:', result);
  }

  console.log('🏷️ formatStorageLabel 最終出力:', result);
  return result;
};

/**
 * CustomButton: Storage Browserのボタンコンポーネントをカスタマイズ
 * 
 * 【役割】
 * - table-dataおよびnavigate variantのボタンテキストをフォーマット
 * 
 * 【修正内容】
 * - デバッグログを追加してボタンの内容を出力
 */
const CustomButton = (
  props: React.ComponentProps<typeof DefaultButton>
) => {
  const { children, variant, ...rest } = props;
  let nextChildren: React.ReactNode = children;

  console.log('🔘 CustomButton レンダリング:', {
    variant,
    children,
    childrenType: typeof children,
  });

  if (typeof children === "string") {
    if (variant === "table-data" || variant === "navigate") {
      nextChildren = formatStorageLabel(children);
      console.log('🔘 CustomButton フォーマット適用:', {
        variant,
        original: children,
        formatted: nextChildren,
      });
    }
  }

  return <DefaultButton {...rest} variant={variant}>{nextChildren}</DefaultButton>;
};

/**
 * CustomSpan: Storage BrowserのSpanコンポーネントをカスタマイズ
 * 
 * 【役割】
 * - navigate-current variantのテキストをフォーマット
 * 
 * 【修正内容】
 * - デバッグログを追加してSpanの内容を出力
 */
const CustomSpan = (
  props: React.ComponentProps<typeof DefaultSpan>
) => {
  const { children, variant, ...rest } = props;
  let nextChildren: React.ReactNode = children;

  console.log('📝 CustomSpan レンダリング:', {
    variant,
    children,
    childrenType: typeof children,
  });

  if (variant === "navigate-current" && typeof children === "string") {
    const formatted = formatStorageLabel(children);
    nextChildren = formatted || "";
    console.log('📝 CustomSpan フォーマット適用:', {
      original: children,
      formatted: nextChildren,
    });
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
 * - items: LocationDataの配列
 *   - id: ロケーションの一意識別子
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
 * 
 * 【修正内容】
 * - 戻り値を{ items: LocationData[] }形式に統一
 * - デバッグログを強化してS3から取得したデータを詳細に出力
 */
const listLocations = async (input = {}) => {
  console.log('========================================');
  console.log('🔍 listLocations が呼ばれました');
  console.log('📦 バケット設定:', bucketConfig);
  console.log('📥 入力パラメータ:', input);
  console.log('========================================');
  
  try {
    // Amplify Storage APIでS3の`public/`配下のフォルダ一覧を取得
    console.log('🔎 S3のpublic/配下を検索中...');
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
    
    // デバッグ: S3から取得した生データを出力
    console.log('✅ S3検索結果:', {
      excludedSubpaths: result.excludedSubpaths,
      excludedSubpathsCount: result.excludedSubpaths?.length ?? 0,
      items: result.items,
      itemsCount: result.items?.length ?? 0,
    });

    // 取得したサブフォルダをStorage Browser形式に変換
    const items = (result.excludedSubpaths ?? []).map((subpath) => {
      // subpathの例: "public/企業A/"
      const locationData = {
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
        type: 'PREFIX' as const,
      };
      
      console.log(`📁 フォルダ検出:`, {
        subpath,
        locationData,
      });
      
      return locationData;
    });

    console.log('📊 返却するロケーション数:', items.length);
    console.log('📋 ロケーション一覧:', items);
    console.log('========================================');

    // AWS Amplify Storage Browser公式ドキュメント通りの戻り値
    // { items: LocationData[], nextToken?: string }
    return {
      items: items,
      nextToken: undefined,
    };
  } catch (error) {
    console.error('❌ listLocationsでエラー発生:', error);
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
 * 【修正内容】
 * - デバッグログを強化して認証情報の状態を詳細に出力
 */
const getLocationCredentials = async (input: any) => {
  console.log('========================================');
  console.log('🔐 getLocationCredentials が呼ばれました');
  console.log('📥 入力パラメータ:', input);
  
  try {
    // Amplify Authからセッション情報を取得
    // このセッションにはCognitoから発行されたAWS一時認証情報が含まれる
    const session = await fetchAuthSession();
    
    console.log('✅ セッション取得完了:', {
      hasCredentials: !!session.credentials,
      hasAccessKeyId: !!session.credentials?.accessKeyId,
      hasSecretAccessKey: !!session.credentials?.secretAccessKey,
      hasSessionToken: !!session.credentials?.sessionToken,
      hasExpiration: !!session.credentials?.expiration,
    });
    
    // 認証情報が存在しない場合はエラー
    if (!session.credentials) {
      console.error('❌ 認証情報が存在しません');
      throw new Error('No credentials available');
    }

    // sessionTokenが存在しない場合もエラー
    if (!session.credentials.sessionToken) {
      console.error('❌ セッショントークンが存在しません');
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
    
    console.log('✅ 認証情報返却完了:', {
      hasAccessKeyId: !!result.credentials.accessKeyId,
      hasSecretAccessKey: !!result.credentials.secretAccessKey,
      hasSessionToken: !!result.credentials.sessionToken,
      expiration: result.credentials.expiration,
    });
    console.log('========================================');
    
    return result;
  } catch (error) {
    console.error('❌ getLocationCredentialsでエラー発生:', error);
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.log('========================================');
    throw error;
  }
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
 * 
 * 【修正内容】
 * - デバッグログを追加してイベントの状態を出力
 */
const registerAuthListener = (onAuthStateChange: () => void) => {
  console.log('========================================');
  console.log('👂 registerAuthListener が呼ばれました');
  
  // Amplify HubでAuth関連イベントを購読
  const { Hub } = require('aws-amplify/utils');
  
  console.log('✅ Hubリスナー登録完了');
  
  Hub.listen('auth', (data: any) => {
    console.log('🔔 Auth イベント受信:', {
      event: data.payload.event,
      payload: data.payload,
    });
    
    // ユーザーがサインアウトした場合
    if (data.payload.event === 'signedOut') {
      console.log('🚪 サインアウトイベント検知 - onAuthStateChangeを呼び出します');
      // Storage Browserに状態変更を通知
      // これによりStorage Browserが保持している認証情報やキャッシュがクリアされる
      onAuthStateChange();
      console.log('✅ onAuthStateChange呼び出し完了');
    }
  });
  
  console.log('========================================');
};

/**
 * Example: Storage Browserコンポーネントのメイン実装
 * 
 * 【修正内容】
 * - createStorageBrowserの初期化処理にデバッグログを追加
 */
function Example() {
  const { StorageBrowser } = useMemo(() => {
    console.log('========================================');
    console.log('🏗️ createStorageBrowser を初期化中...');
    console.log('📦 設定:', {
      region: bucketConfig.region,
      bucket: bucketConfig.bucket,
      accountId: '481356005647',
    });
    console.log('========================================');
    
    const result = createStorageBrowser({
      elements: customElements,
      // カスタムconfigを使用してStorage Browserを初期化
      // 型定義が不完全なためas anyでバイパス
      config: {
        // AWSリージョン（amplify_outputs.jsonから取得）
        region: bucketConfig.region,
        // AWSアカウントID（必須）
        accountId: '481356005647',
        
        // ロケーション一覧取得関数
        listLocations: listLocations,
        
        // 認証情報取得関数
        getLocationCredentials,
        
        // 認証状態監視リスナー登録関数
        registerAuthListener,
      } as any,
    });
    
    console.log('✅ createStorageBrowser 初期化完了');
    return result;
  }, []);

  return (
    <>
      <Button
        marginBlockEnd="xl"
        size="small"
        onClick={() => {
          console.log('🚪 サインアウトボタンがクリックされました');
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
