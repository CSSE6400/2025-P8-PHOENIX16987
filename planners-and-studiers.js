// 导入 k6 的 HTTP 请求模块
// http 模块提供发送 HTTP 请求的方法
import http from "k6/http";

// 导入检查和睡眠函数
// check 用于验证 HTTP 响应
// sleep 模拟用户处理任务的间隔时间
import { check, sleep } from "k6";

// 从环境变量获取 API 端点
// 允许在运行时动态指定测试的 API 地址
const ENDPOINT = __ENV.ENDPOINT;

// 导出测试配置
export const options = { 
   // 定义测试场景
   scenarios: { 
      // 学习者场景：模拟学生查看待办事项
      studier: { 
         // 执行 studyingStudent 函数
         exec: 'studyingStudent', 
         
         // 使用渐进式虚拟用户（VUS）executor
         // 可以逐步增加和减少并发用户数
         executor: "ramping-vus", 
         
         // 负载变化阶段
         stages: [ 
            // 第1分钟：从0用户增加到1500用户
            { duration: "1m", target: 1500 }, 
            
            // 接下来3分钟：保持在7500用户
            { duration: "3m", target: 7500 }, 
            
            // 最后2分钟：逐渐减少到0用户
            { duration: "2m", target: 0 }, 
         ], 
      }, 
      
      // 不确定的规划者场景
      planner: { 
         // 执行 indecisivePlanner 函数
         exec: 'indecisivePlanner', 
         
         // 使用共享迭代 executor
         // 固定数量的用户完成固定次数的迭代
         executor: "shared-iterations", 
         
         // 固定20个虚拟用户
         vus: 20, 
         
         // 总计400次任务创建和删除操作
         iterations: 400, 
      }, 
   }, 
};

// 模拟学习者行为的函数
export function studyingStudent() { 
   // 构建获取待办事项的 API 请求 URL
   let url = `${ENDPOINT}/api/v1/todos`; 
 
   // 发送 GET 请求获取待办事项列表
   let request = http.get(url); 
 
   // 使用 check 函数验证响应
   check(request, { 
      // 验证响应状态码是否为 200（成功）
      '响应状态码为 200': (r) => r.status === 200, 
   }); 
 
   // 模拟学生处理任务的时间
   // 睡眠 2 分钟（120秒）模拟查看和思考任务
   sleep(120); 
}

// 模拟不确定的规划者行为的函数
export function indecisivePlanner() { 
   // 构建待办事项 API 的 URL
   let url = `${ENDPOINT}/api/v1/todos`; 
 
   // 创建一个错误拼写的任务
   // 模拟学生匆忙中错误输入任务名称
   const payload = JSON.stringify({ 
      "title": "CSSE6400 Clout Assignment", // 注意：这里故意拼错 "Clout"
      "completed": false, 
      "description": "", 
      "deadline_at": "2025-09-05T15:00:00", 
   }); 
 
   // 设置请求头，指定内容类型为 JSON
   const params = { 
      headers: { 
         'Content-Type': 'application/json', 
      }, 
   }; 
 
   // 发送 POST 请求创建任务
   let request = http.post(url, payload, params); 

   // 验证任务创建的响应
   check(request, { 
      '状态码为 200': (r) => r.status === 200, 
   }); 
 
   // 短暂停顿，模拟思考
   sleep(10); 
 
   // 获取刚创建任务的 ID
   // 注意：原代码中 request.id 可能不存在
   // 需要从响应体中解析 ID
   let taskId;
   try {
      taskId = JSON.parse(request.body).id;
   } catch (e) {
      console.error('无法获取任务ID');
      return;
   }
 
   // 删除错误输入的任务
   // 使用模板字符串构建删除 URL
   request = http.del(`${url}/${taskId}`); 
 
   // 验证任务删除的响应
   check(request, { 
      '状态码为 200': (r) => r.status === 200, 
   }); 
 
   // 再次短暂停顿，模拟思考
   sleep(10); 
}