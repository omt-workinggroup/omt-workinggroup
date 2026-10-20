export type ShellHandle = { goBack: () => void; reload: () => void };

export type ShellProps = {
  uri: string;
  onGoHome: () => void;
  onCanGoBack: (canGoBack: boolean) => void;
  onProgress: (progress: number) => void;
  onPageColour: (colour: string) => void;
  onLoaded: () => void;
  onFailed: () => void;
};
