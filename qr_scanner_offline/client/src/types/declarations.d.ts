// Déclarations de modules pour résoudre les erreurs TypeScript

declare module 'wouter' {
  import * as React from 'react';
  
  type NavigateFunction = (to: string) => void;
  
  export function useRoute(pattern: string): [boolean, Record<string, string>];
  export function useLocation(): [string, NavigateFunction];
  export function useSearchParams(): [URLSearchParams, (params: Record<string, string>) => void];
  export function useParams<T = Record<string, string>>(): T;
  export function useNavigate(): NavigateFunction;
  
  export interface RouteProps {
    path?: string;
    component?: React.ComponentType<any>;
    children?: React.ReactNode;
  }
  
  export function Route(props: RouteProps): React.ReactElement | null;
  
  export interface SwitchProps {
    children?: React.ReactNode;
    location?: string;
  }
  
  export function Switch(props: SwitchProps): React.ReactElement;
  
  export function Link(props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }): React.ReactElement;
  export function Redirect(props: { to: string }): React.ReactElement;
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toString(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: any): Promise<void>;
  export function toBuffer(text: string, options?: any): Promise<Buffer>;
}

declare module '@trpc/server' {
  export class TRPCError extends Error {
    constructor(opts: { code: string; message?: string });
    code: string;
  }
  
  export function initTRPC<T>(): {
    router: any;
    procedure: any;
    middleware: any;
    create: (opts?: any) => any;
    context: any;
  };
  
  export * from '@trpc/server/dist/index';
}

declare global {
  interface Window {
    posthog?: any;
  }
}
