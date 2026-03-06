package k8s

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

func listOptions() metav1.ListOptions {
	return metav1.ListOptions{}
}

func getOptions() metav1.GetOptions {
	return metav1.GetOptions{}
}
