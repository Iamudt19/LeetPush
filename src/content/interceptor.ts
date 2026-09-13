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

  // Helper to store captured code in hidden DOM elements for isolated context reading
  function updateHiddenDomElement(id: string, value: string) {
    try {
      let el = document.getElementById(id) as HTMLTextAreaElement | null;
      if (!el) {
        el = document.createElement('textarea');
        el.id = id;
        el.style.display = 'none';
        (document.body || document.documentElement).appendChild(el);
      }
      el.value = value;
    } catch {
      // Ignore DOM errors
    }
  }

  function getMonacoCodeFromMainWorld(): string {
    try {
      if (win.monaco?.editor?.getModels) {
        const models = win.monaco.editor.getModels();
        for (const m of models) {
          const val = m.getValue();
          if (val && val.trim().length > 0) return val;
        }
      }
    } catch {
      // Ignore
    }
    return '';
  }

  // Listen for code requests from content script (isolated context)
  window.addEventListener('LEETPUSH_REQUEST_MONACO_CODE', () => {
    const code = getMonacoCodeFromMainWorld();
    if (code) {
      win.__LEETPUSH_LAST_SUBMITTED_CODE__ = code;
      updateHiddenDomElement('leetpush-monaco-code', code);
    }
    window.dispatchEvent(
      new CustomEvent('LEETPUSH_RESPONSE_MONACO_CODE', {
        detail: { code },
      })
    );
  });

  // Helper to extract submitted code from outgoing request body
  function extractSubmittedCodeFromBody(bodyStr: any): string | null {
    if (!bodyStr) return null;
    try {
      const str = typeof bodyStr === 'string' ? bodyStr : '';
      if (!str) return null;
      const parsed = JSON.parse(str);
      const code =
        parsed.typed_code ||
        parsed.code ||
        parsed.variables?.code ||
        parsed.variables?.typed_code;
      if (typeof code === 'string' && code.trim().length > 0) {
        return code;
      }
    } catch {
      // Ignore JSON parse errors
    }
    return null;
  }

  // 1. Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args: any[]) {
    try {
      // Intercept outgoing submission request body to catch typed_code
      if (args[1] && args[1].body) {
        const capturedCode = extractSubmittedCodeFromBody(args[1].body);
        if (capturedCode) {
          win.__LEETPUSH_LAST_SUBMITTED_CODE__ = capturedCode;
          updateHiddenDomElement('leetpush-submitted-code', capturedCode);
        }
      }
    } catch {
      // Ignore request extraction errors
    }

    const response = await originalFetch.apply(this, args as any);

    try {
      const url =
        typeof args[0] === 'string'
          ? args[0]
          : args[0] && args[0].url
          ? args[0].url
          : '';

      // Intercept submission check endpoint: /submissions/detail/<id>/check/
      if (url.includes('/submissions/detail/') && url.includes('/check/') && !url.includes('runcode')) {
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
              // Attach captured full code if not present in check response
              if (!data.code && win.__LEETPUSH_LAST_SUBMITTED_CODE__) {
                data.code = win.__LEETPUSH_LAST_SUBMITTED_CODE__;
              } else if (!data.code) {
                data.code = getMonacoCodeFromMainWorld();
              }

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
                if (win.__LEETPUSH_LAST_SUBMITTED_CODE__ && !resJson.data.code) {
                  resJson.data.code = win.__LEETPUSH_LAST_SUBMITTED_CODE__;
                }
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
    try {
      if (args[0]) {
        const capturedCode = extractSubmittedCodeFromBody(args[0]);
        if (capturedCode) {
          win.__LEETPUSH_LAST_SUBMITTED_CODE__ = capturedCode;
          updateHiddenDomElement('leetpush-submitted-code', capturedCode);
        }
      }
    } catch {
      // Ignore
    }

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
            if (!data.code && win.__LEETPUSH_LAST_SUBMITTED_CODE__) {
              data.code = win.__LEETPUSH_LAST_SUBMITTED_CODE__;
            } else if (!data.code) {
              data.code = getMonacoCodeFromMainWorld();
            }

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
