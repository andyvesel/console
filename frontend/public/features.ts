/* eslint-disable no-undef */

import { connect } from 'react-redux';
import * as Immutable from 'immutable';
import * as _ from 'lodash';

import { k8sBasePath } from './module/k8s';
import { coFetchJSON } from './co-fetch';

export enum FLAGS {
  AUTH_ENABLED = 'AUTH_ENABLED',
  CLUSTER_UPDATES = 'CLUSTER_UPDATES',
  ETCD_OPERATOR = 'ETCD_OPERATOR',
  PROMETHEUS = 'PROMETHEUS',
  MULTI_CLUSTER = 'MULTI_CLUSTER',
  SECURITY_LABELLER = 'SECURITY_LABELLER',
  CLOUD_SERVICES = 'CLOUD_SERVICES',
  CLOUD_CATALOGS = 'CLOUD_CATALOGS',
  CALICO = 'CALICO',
}

const DEFAULTS = {
  [FLAGS.AUTH_ENABLED]: !(window as any).SERVER_FLAGS.authDisabled,
  [FLAGS.CLUSTER_UPDATES]: undefined,
  [FLAGS.ETCD_OPERATOR]: undefined,
  [FLAGS.PROMETHEUS]: undefined,
  [FLAGS.MULTI_CLUSTER]: undefined,
  [FLAGS.SECURITY_LABELLER]: undefined,
  [FLAGS.CLOUD_SERVICES]: undefined,
  [FLAGS.CLOUD_CATALOGS]: undefined,
  [FLAGS.CALICO]: undefined,
};

const SET_FLAGS = 'SET_FLAGS';
const setFlags = (dispatch, flags) => dispatch({flags, type: SET_FLAGS});

const handleError = (res, flags, dispatch, cb) => {
  const status = _.get(res, 'response.status');
  if (status === 403 || status === 502) {
    setFlags(dispatch, _.mapValues(flags, () => undefined));
  } else {
    setTimeout(() => cb(dispatch), 15000);
  }
};

//These flags are currently being set on the client side for Phase 0 of this
//feature, the plan is to move them to the backend eventually.
const determineMultiClusterFlag = () => {
  const fedApiUrl = localStorage.getItem('federation-apiserver-url') || null;
  const token = localStorage.getItem('federation-apiserver-token') || null;

  if (fedApiUrl && token) {
    return {
      [FLAGS.MULTI_CLUSTER]: {
        'federation-apiserver-url': fedApiUrl,
        'federation-apiserver-token': token,
      }
    };
  }
  return { [FLAGS.MULTI_CLUSTER]: undefined };
};

const TCO_FLAGS = {
  [FLAGS.CLUSTER_UPDATES]: 'channeloperatorconfigs',
};

const ETCD_OPERATOR_FLAGS = {
  [FLAGS.ETCD_OPERATOR]: 'etcdclusters',
};

const PROMETHEUS_FLAGS = {
  [FLAGS.PROMETHEUS]: 'prometheuses'
};

const SECURITY_LABELLER_FLAGS = {
  [FLAGS.SECURITY_LABELLER]: 'security-labeller-app',
};

const CLOUD_SERVICES_FLAGS = {
  [FLAGS.CLOUD_SERVICES]: 'clusterserviceversion-v1s',
  [FLAGS.CLOUD_CATALOGS]: 'alphacatalogentry-v1s',
};

const CALICO_FLAGS = {
  [FLAGS.CALICO]: 'kube-calico',
};

const tcoPath = `${k8sBasePath}/apis/tco.coreos.com/v1`;
const detectTectonicChannelOperatorFlags = dispatch => {
  coFetchJSON(tcoPath)
    .then(res => setFlags(dispatch, _.mapValues(TCO_FLAGS, name => _.find(res.resources, {name}))),
      (res) => handleError(res, TCO_FLAGS, dispatch, detectTectonicChannelOperatorFlags));
};

const etcdPath = `${k8sBasePath}/apis/etcd.database.coreos.com/v1beta2`;
const detectEtcdOperatorFlags = dispatch => coFetchJSON(etcdPath)
  .then(res => setFlags(dispatch, _.mapValues(ETCD_OPERATOR_FLAGS, name => _.find(res.resources, {name}))),
    (res) => handleError(res, ETCD_OPERATOR_FLAGS, dispatch, detectEtcdOperatorFlags));


const monitoringPath = `${k8sBasePath}/apis/monitoring.coreos.com/v1`;
const detectPrometheusFlags = dispatch => coFetchJSON(monitoringPath)
  .then(res => setFlags(dispatch, _.mapValues(PROMETHEUS_FLAGS, name => _.find(res.resources, {name}))),
    (res) => handleError(res, PROMETHEUS_FLAGS, dispatch, detectPrometheusFlags));

const detectMultiClusterFlags = dispatch => {
  const multiCluster = determineMultiClusterFlag();
  setFlags(dispatch, multiCluster);
};

const labellerDeploymentPath = `${k8sBasePath}/apis/extensions/v1beta1/deployments`;
const detectSecurityLabellerFlags = dispatch => coFetchJSON(labellerDeploymentPath)
  .then(res => setFlags(dispatch, _.mapValues(SECURITY_LABELLER_FLAGS, name => _.find(_.map(res.items, (item: any) => item.metadata), {name}))),
    (res) => handleError(res, SECURITY_LABELLER_FLAGS, dispatch, detectSecurityLabellerFlags));

const cloudServicesPath = `${k8sBasePath}/apis/app.coreos.com/v1alpha1`;
const detectCloudServicesFlags = dispatch => coFetchJSON(cloudServicesPath)
  .then(res => setFlags(dispatch, _.mapValues(CLOUD_SERVICES_FLAGS, name => _.find(res.resources, {name}))),
    (res) => handleError(res, CLOUD_SERVICES_FLAGS, dispatch, detectCloudServicesFlags));

const calicoDaemonSetPath = `${k8sBasePath}/apis/extensions/v1beta1/daemonsets`;
const detectCalicoFlags = dispatch => coFetchJSON(calicoDaemonSetPath)
  .then(res => setFlags(dispatch, _.mapValues(CALICO_FLAGS, name => _.find(_.map(res.items, (item: any) => item.metadata), {name}))),
    (res) => handleError(res, CALICO_FLAGS, dispatch, detectCalicoFlags));

export const featureActions = {
  detectTectonicChannelOperatorFlags,
  detectEtcdOperatorFlags,
  detectPrometheusFlags,
  detectMultiClusterFlags,
  detectSecurityLabellerFlags,
  detectCloudServicesFlags,
  detectCalicoFlags,
  handleError,
};

export const featureReducerName = 'FLAGS';
export const featureReducer = (state, action) => {
  if (!state) {
    return Immutable.Map(DEFAULTS);
  }

  if (action.type === SET_FLAGS) {
    _.each(action.flags, (v, k) => {
      if (!FLAGS[k]) {
        throw new Error(`unknown key for reducer ${k}`);
      }
    });
    return state.merge(action.flags);
  }
  return state;
};

export const stateToProps = (flags, state) => {
  const props = {flags: {}};
  _.each(flags, f => {
    props.flags[f] = _.get(state[featureReducerName].toJSON(), f);
  });
  return props;
};

export const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign({}, ownProps, stateProps, dispatchProps);

export const areStatesEqual = (next, previous) => next.FLAGS.equals(previous.FLAGS) &&
  next.UI.get('activeNamespace') === previous.UI.get('activeNamespace') &&
  next.UI.get('location') === previous.UI.get('location');

export const connectToFlags = (...flags) => connect(state => stateToProps(flags, state));