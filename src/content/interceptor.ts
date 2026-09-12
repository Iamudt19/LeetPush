/**
 * Interceptor script that runs in the MAIN world context of leetcode.com.
 * Hooks window.fetch and XMLHttpRequest to catch submission responses directly
 * without CSP restrictions.
 */

(function () {
  const win = window as any;
  if (win.__LEETPUSH_INTERCEPTOR_INSTALLED__) return;
  win.__LEETPUSH_INTERCEPTOR_INSTALLED__ = true;

  console.info('[LeetPush] Interceptor installed in MAIN world context');

  // 1. Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args: any[]) {
    const response = await originalFetch.apply(this, args as any);

    try {
      const url =
        typeof args[0] === 'string'
          ? args[0]
          : args[0] && args[0].url
          ? args[0].url
          : '';

      // Intercept submission check endpoint: /submissions/detail/<id>/check/
      if (url.includes('/submissions/detail/') && url.includes('/check/')) {
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            if (
              data &&
              (data.status_msg === 'Accepted' ||
                data.state === 'SUCCESS' ||
                data.status_code === 10)
            ) {
              window.dispatchEvent(
                new CustomEvent('LEETPUSH_SUBMISSION_EVENT', {
                  detail: {
                    source: 'fetch_check',
                    url,
                    data,
                  },
                })
              );
            }
          })
          .catch(() => {});
      }

      // Intercept GraphQL submission responses
      if (url.includes('/graphql') && args[1] && typeof args[1].body === 'string') {
        const bodyStr = args[1].body;
        if (
          bodyStr.includes('submissionDetails') ||
          bodyStr.includes('submitCode') ||
          bodyStr.includes('checkSubmissionStatus')
        ) {
          const clone = response.clone();
          clone
            .json()
            .then((resJson) => {
              if (resJson && resJson.data) {
                window.dispatchEvent(
                  new CustomEvent('LEETPUSH_SUBMISSION_EVENT', {
                    detail: {
                      source: 'fetch_graphql',
                      url,
                      data: resJson.data,
                    },
                  })
                );
              }
            })
            .catch(() => {});
        }
      }
    } catch {
      // Ignore interception errors to avoid breaking LeetCode UI
    }

    return response;
  };

  // 2. Intercept XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any).__leetpush_url = String(url);
    return originalXhrOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    this.addEventListener('load', function () {
      try {
        const url = (this as any).__leetpush_url || '';
        if (url.includes('/submissions/detail/') && url.includes('/check/')) {
          const data = JSON.parse(this.responseText);
          if (
            data &&
            (data.status_msg === 'Accepted' ||
              data.state === 'SUCCESS' ||
              data.status_code === 10)
          ) {
            window.dispatchEvent(
              new CustomEvent('LEETPUSH_SUBMISSION_EVENT', {
                detail: {
                  source: 'xhr_check',
                  url,
                  data,
                },
              })
            );
          }
        }
      } catch {
        // Ignore
      }
    });

    return originalXhrSend.apply(this, args as any);
  };
})();
