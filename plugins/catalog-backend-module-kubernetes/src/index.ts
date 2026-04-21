export { catalogModuleKubernetes as default } from './module';
export {
  CrdApiEntityProvider,
  KubernetesEntityProvider,
  KubernetesDataProvider,
} from './providers';
export {
  DefaultKubernetesResourceFetcher,
  type KubernetesResourceFetcher,
  type KubernetesResourceFetcherOptions,
} from './services';
export type { KubernetesProviderConfig } from './lib/config';
