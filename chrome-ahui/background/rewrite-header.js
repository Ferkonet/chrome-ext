/*
 *
extension example:
- ModHeader: https://chromewebstore.google.com/detail/ModHeader%20-%20Modify%20HTTP%20headers/idgpnmonknjnojddfkpgkljpfnnfcklj?hl=en

比较"declarativeNetRequest"和"declarativeNetRequestWithHostAccess" 
- 相同: 
  1. 都可用于阻止请求、将请求重定向到不同的URL、修改请求和响应的header。都不能修改响应body
- 不同：
    1. 若申请的是declarativeNetRequest权限，则阻止或升级请求不需要申请"host_permissions"，但是如果需要重定向请求，或者修改请求头，则要申请相应的"host_permissions"
    2. 若申请的是declarativeNetRequestWithHostAccess权限，则任何功能都需要申请相应的"host_permissions"。
方案：
1. declarativeNetRequest 重定向（推荐）：
- 优点：性能最好，在网络层直接重定向
  - 缺点：需要 host_permissions 权限
    - 支持的操作：所有 HTTP 请求都会被重定向;

2. Content Script + fetch 拦截：
- 优点：灵活性高，可以对特定请求进行处理
  - 缺点：只能拦截页面中的 fetch / XMLHttpRequest，无法拦截 img、css 等资源请求;

3. Service Worker 拦截（仅适用于 PWA）：
- 优点：可以拦截所有网络请求
    - 缺点：只在支持 Service Worker 的页面中有效;

  */;
const allResourceTypes = Object.values(
  chrome.declarativeNetRequest.ResourceType,
); //["script","image","xmlhttprequest",...]

// https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-RuleActionType
// 支持: BLOCK, ALLOW, MODIFY_HEADERS, REDIRECT
const rules = [
  {
    id: 1,
    priority: 1,
    action: {
      // modify request header1
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,//modifyHeaders
      requestHeaders: [
        {
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          header: "x-forwarded-for",
          value: "8.8.8.8",
        },
      ],
    },
    condition: {
      urlFilter: "http://m:4500/dump/modify-request-header",
      // urlFilter: "https://www.bing21.com/",
      resourceTypes: allResourceTypes,
    },
  },
  {
    id: 2,
    priority: 1,
    action: {
      // add response header
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      responseHeaders: [
        {
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          header: "x-test-response-header",
          value: "test-value",
        },
      ],
    },
    condition: {
      //chrome network 观察不到
      //只能：fetch('http://m:4500/dump/modify-response-header/any').then(async d=>{console.log(...d.headers)})
      //或: response.headers.get('x-test-response-header')
      urlFilter: "/dump/modify-response-header",
      resourceTypes: allResourceTypes,
    },
  },
  {
    // 重定向规则：在baidu.com页面中，把带有'/sugrec'的接口请求中，添加wa参数"a132"
    "id": 3,
    "priority": 5,
    "aciton": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "queryTransform": {
            "addOrReplaceParams": [
              {
                "key": "wa",
                "replaceOnly": true,
                "value": "a132"
              }
            ]
          }
        }
      }
    },
    "condition": {
      "urlFilter": "/sugrec",
      "domains": ["||baidu.com"],
      "resourceTypes": ["xmlhttprequest"]
    }
  },
  {
    /**
    重定向规则：将 https://a.com 的所有请求重定向到 http://localhost:8080
    当前实现使用方案1，同时提供了两种重定向方式：
    - regexSubstitution：使用正则表达式替换
    - transform：使用结构化转换
    */
    id: 4,
    priority: 10,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        regexSubstitution: "http://localhost:8080\\1"
      }
    },
    condition: {
      regexFilter: "^https://a\\.com(/.*)?$",
      resourceTypes: allResourceTypes,
    }
  },
  {
    // 备选方案：使用 transform 进行更精确的重定向
    // 这种方式可以更精确地控制重定向的各个部分
    id: 5,
    priority: 9,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        transform: {
          scheme: "http",
          host: "localhost",
          port: "8080"
          // 路径和查询参数会自动保持不变
        }
      }
    },
    condition: {
      urlFilter: "https://a.com/*",
      resourceTypes: allResourceTypes,
    }
  },
];

/* 1. modifying headers of request
 * refer:  https://stackoverflow.com/questions/3274144/can-i-modify-outgoing-request-headers-with-a-chrome-extension
 */
chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: rules.map((rule) => rule.id), // remove existing rules
  addRules: rules,
});
