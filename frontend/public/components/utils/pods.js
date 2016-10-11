// This logic (at this writing, Kubernetes 1.2.2) is replicated in kubeconfig
// (See https://github.com/kubernetes/kubernetes/blob/v1.3.0-alpha.2/pkg/kubectl/resource_printer.go#L574 )
export const podPhase = (pod) => {
  if (!pod || !pod.status) {
    return '';
  }

  if (pod.metadata.deletionTimestamp) {
    return 'Terminating';
  }

  let ret = pod.status.phase;
  if (pod.status.reason) {
    ret = pod.status.reason;
  }

  if (pod.status.containerStatuses) {
    pod.status.containerStatuses.forEach(function(container) {
      if (container.state.waiting && container.state.waiting.reason) {
        ret = container.state.waiting.reason;
      } else if (container.state.terminated && container.state.terminated.reason) {
        ret = container.state.terminated.reason;
      }
      // kubectl has code here that populates the field if
      // terminated && !reason, but at this writing there appears to
      // be no codepath that will produce that sort of output inside
      // of the kubelet.
    });
  }

  return ret;
}
