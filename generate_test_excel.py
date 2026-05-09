#!/usr/bin/env python3
"""
生成测试用 Excel 文件
"""
import pandas as pd

# 创建测试数据
data = {
    '客户名称': ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'],
    '邮箱地址': [
        'zhangsan@example.com',
        'lisi@example.com',
        'wangwu@example.com',
        'zhaoliu@example.com',
        'sunqi@example.com',
        'zhouba@example.com',
        'wujiu@example.com',
        'zhengshi@example.com'
    ]
}

# 创建 DataFrame
df = pd.DataFrame(data)

# 保存为 Excel
df.to_excel('客户列表模板.xlsx', index=False)

print("✅ 测试 Excel 文件已生成：客户列表模板.xlsx")
print("包含 8 个测试客户数据")
