# Application control-plane backend

Returns only applications visible through effective Keycloak-backed group role.
Catalog reads use service credentials, then explicit ownership filtering prevents
frontend query manipulation from exposing restricted entities. No generic
Kubernetes or Argo proxy is exposed.
