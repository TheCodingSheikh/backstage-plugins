# Needed Kubernetes RBAC
In order for this plugin to work, you do need to give the ServiceAccount used in Backstage a set of permissions which can differ based on the capabilities you want the plugin to perform. bellow you can find example scenarios, and the needed RBAC for them.

# TLDR
If you want a basic setup, supporting all features, and easy management, the following manifest can configure all the needed RBAC for the ServiceAccount, and the only step you must do is configure Backstage to use its token, which is documented bellow. For more specific configurations check the rest of the documentation bellow.

```bash
kubectl apply --filename - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: backstage-system
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backstage-user
  namespace: backstage-system
---
apiVersion: v1
kind: Secret
metadata:
  name: backstage-token
  namespace: backstage-system
  annotations:
    kubernetes.io/service-account.name: backstage-user
type: kubernetes.io/service-account-token
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-kubernetes-ingestor-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
- kind: ServiceAccount
  name: backstage-user
  namespace: backstage-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backstage-crd-viewer
rules:
- apiGroups:
  - apiextensions.k8s.io
  resources:
  - customresourcedefinitions
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-crossplane-ingestion-crd-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: backstage-crd-viewer
subjects:
- kind: ServiceAccount
  name: backstage-user
  namespace: backstage-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-crossplane-ingestion-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: crossplane-view
subjects:
- kind: ServiceAccount
  name: backstage-user
  namespace: backstage-system
EOF
```
All of the examples are created using a sample ServiceAccount called backstage-user in the backstage-system namespace, but can be changed to whatever you need.

# Create the ServiceAccount and needed baseline resources
The first step is going to be to create the ServiceAccount if it does not exist and create a long lived token secret for it, which will be used by the Kubernetes backend in Backstage to interact with the Kubernetes API.
1. Create the backstage-system namespace
```bash
kubectl create ns backstage-system --dry-run=client -o yaml | kubectl apply -f -
```
2. Create the ServiceAccount
```bash
kubectl create sa backstage-user -n backstage-system --dry-run=client -o yaml | kubectl apply -f -
```
3. Create the secret with the needed token for the new ServiceAccount
```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: backstage-token
  namespace: backstage-system
  annotations:
    kubernetes.io/service-account.name: backstage-user
type: kubernetes.io/service-account-token
EOF
```
4. Retrieve the generated token
```bash
kubectl get secret -n backstage-system backstage-token -o jsonpath='{.data.token}' | base64 --decode
```
5. Update your app-config.yaml to use the generated token for communicating with your cluster based on the [official docs](https://backstage.io/docs/features/kubernetes/configuration).

## Scenario 1 - Ingest Native Kubernetes Workload Types
In order to ingest the standard Kubernetes Workload types as components, the bellow ClusterRoleBinding should be created:
```bash
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-kubernetes-ingestor-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
- kind: ServiceAccount
  name: backstage-user
  namespace: backstage-system
EOF
```
## Scenario 2 - Crossplane Ingestions of Claims and XRDs
For this we need to add permissions to view crossplane resources and CRDs
```bash
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backstage-crd-viewer
rules:
- apiGroups:
  - apiextensions.k8s.io
  resources:
  - customresourcedefinitions
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-crossplane-ingestion-crd-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: backstage-crd-viewer
subjects:
- kind: ServiceAccount
  name: backstage-user
  namespace: backstage-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-crossplane-ingestion-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: crossplane-browse
subjects:
- kind: ServiceAccount
  name: backstage-user
  namespace: backstage-system
EOF
```
## Scenario 3 - Crossplane Ingestion + Crossplane Visualization 
For this we need to add permissions to view crossplane resources, including managed resources.
```bash
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-crossplane-visualization-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: crossplane-view
subjects:
- kind: ServiceAccount
  name: backstage-user
  namespace: backstage-system
EOF