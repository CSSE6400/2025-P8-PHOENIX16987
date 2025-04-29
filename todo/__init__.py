import os
import boto3
import watchtower, logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask import has_request_context, request
import uuid  # 导入uuid模块用于生成唯一请求ID

# 自定义结构化日志格式化器类，继承自watchtower.CloudWatchLogFormatter
class StructuredFormatter(watchtower.CloudWatchLogFormatter):
   def format(self, record):
       # 将日志记录转换为包含元数据的JSON对象
       record.msg = {
           'timestamp': record.created,  # 添加时间戳
           'location': record.name,      # 添加日志来源位置
           'message': record.msg,        # 添加原始日志消息
       }
       # 如果在HTTP请求上下文中，添加请求相关信息
       if has_request_context():
           record.msg['request_id'] = request.environ.get('REQUEST_ID')  # 添加请求ID
           record.msg['url'] = request.environ.get('PATH_INFO')          # 添加请求URL
           record.msg['method'] = request.environ.get('REQUEST_METHOD')  # 添加HTTP方法
       return super().format(record)  # 调用父类方法完成格式化


def create_app(config_overrides=None):
   logging.basicConfig(level=logging.INFO)
   app = Flask(__name__, static_folder='app', static_url_path="/")
   
   app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("SQLALCHEMY_DATABASE_URI", "sqlite:///db.sqlite")
   if config_overrides:
       app.config.update(config_overrides)
   
   # 创建CloudWatch日志处理器
   handler = watchtower.CloudWatchLogHandler(
       log_group_name="taskoverflow",
       boto3_client=boto3.client("logs", region_name="us-east-1")
   )
   
   # 设置结构化日志格式化器
   handler.setFormatter(StructuredFormatter())
   
   # 添加处理器到各种日志记录器
   app.logger.addHandler(handler)
   logging.getLogger().addHandler(handler)
   logging.getLogger('werkzeug').addHandler(handler)
   logging.getLogger("sqlalchemy.engine").addHandler(handler)
   logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
   
   # 创建请求日志记录器
   requests = logging.getLogger("requests")
   requests.addHandler(handler)
   
   # 请求前中间件：为每个请求生成唯一ID并记录请求开始
   @app.before_request
   def before_request():
       # 生成唯一的UUID作为请求ID
       request.environ['REQUEST_ID'] = str(uuid.uuid4())
       # 记录请求开始的日志
       requests.info("Request started")
   
   # 请求后中间件：记录请求完成并返回响应
   @app.after_request
   def after_request(response):
       # 记录请求完成的日志
       requests.info("Request finished")
       # 返回原始响应
       return response

   # Load the models
   from todo.models import db
   from todo.models.todo import Todo
   db.init_app(app)
   
   # Create the database tables
   with app.app_context():
       db.create_all()
       db.session.commit()
   
   # Register the blueprints
   from todo.views.routes import api
   app.register_blueprint(api)
   
   app.add_url_rule('/', 'index', lambda: app.send_static_file('index.html'))
   
   return app